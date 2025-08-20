import { useConnectWallet, useCurrentWallet, useDisconnectWallet, useIotaClient } from '@iota/dapp-kit';
import { Transaction } from '@iota/iota-sdk/transactions';
import { fromBase64, fromHex, toHex } from '@iota/iota-sdk/utils';
import { SUI_COIN, buildCoinTransferTxb, isSameAddress } from '@msafe/iota-utils';
import { MSafeWallet } from '@msafe/iota-wallet';
import { Button, PageHeader, TextField, shortAddress } from '@msafe/msafe-ui';
import { CheckCircle } from '@mui/icons-material';
import { Box, Container, Stack, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import { useEffect, useMemo, useState } from 'react';
import { CopyBlock } from 'react-code-blocks';
const code = `import { Transaction } from '@iota/iota-sdk/transactions';
import { toHex } from '@iota/iota-sdk/utils';

const tx = new Transaction();
// Your build logic here
const txBytes = tx.build();
// Copy below txHex content to input
const txHex = toHex(txBytes);`;

export default function App() {
  const { mutate: disconnect } = useDisconnectWallet();
  const { mutate: connect } = useConnectWallet();

  const { enqueueSnackbar } = useSnackbar();

  const iotaClient = useIotaClient();
  const wallet = useCurrentWallet();
  const account = useMemo(() => {
    if (wallet.currentWallet && wallet.currentWallet.accounts) {
      return wallet.currentWallet.accounts[0];
    }
    return null;
  }, [wallet]);
  const [txContent, setTxContent] = useState('');
  const [proposing, setProposing] = useState(false);
  const [generating, setGenerating] = useState(false);

  const connectWallet = () => {
    connect({
      wallet: new MSafeWallet('msafe-plain-tx', iotaClient, 'iota:testnet'),
      silent: true,
    });
  };

  useEffect(() => {
    connectWallet();
  }, []);

  const signAndExecuteTransaction = useMemo(() => {
    if (!wallet.currentWallet) {
      return null;
    }
    const feature = wallet.currentWallet.features['iota:signAndExecuteTransaction'];
    if (!feature) {
      return null;
    }
    return (feature as any).signAndExecuteTransaction;
  }, [wallet]);

  return (
    <Container sx={{ mt: 4 }}>
      <Stack spacing={3}>
        <PageHeader
          mainTitle="Plain Transaction"
          subtitle="Propose your plain transaction with MSafe multisig protection"
          action={
            wallet.isConnected ? (
              <Button
                variant="outlined"
                color="secondary"
                onClick={() => disconnect()}
                startIcon={<CheckCircle color="success" />}
              >
                {account ? shortAddress(account.address) : 'Disconnect'}
              </Button>
            ) : (
              <Button variant="outlined" color="secondary" onClick={connectWallet}>
                Connect
              </Button>
            )
          }
        />
        <TextField
          label="Transaction Block"
          placeholder="Please input your transaction block hex or base64 encoded."
          rows={7}
          multiline
          value={txContent}
          onChange={(v) => {
            setTxContent(v.target.value);
          }}
        />
        <Stack direction="row" spacing={1}>
          <Box flexGrow={1} />
          <Button
            variant="contained"
            color="secondary"
            disabled={!wallet.isConnected}
            loading={generating}
            onClick={() => {
              if (account && account.address) {
                setGenerating(true);
                buildCoinTransferTxb(
                  iotaClient,
                  {
                    amount: '10000000',
                    coinType: SUI_COIN,
                    recipient: '0x1ae9faeabb24d601107eccd7b6547d31847f141f673ed6587efec837ee0e6c64',
                  },
                  account.address,
                )
                  .then((tb) => {
                    tb.build({ client: iotaClient })
                      .then((res) => {
                        setTxContent(toHex(res));
                      })
                      .finally(() => setGenerating(false));
                  })
                  .catch(() => setGenerating(false));
              }
            }}
          >
            Generate Demo Payload
          </Button>
          <Button
            variant="contained"
            color="primary"
            disabled={!wallet.isConnected}
            loading={proposing}
            onClick={async () => {
              try {
                let decodedBytes: Uint8Array;
                let inputContent = txContent.trim();
                if (inputContent.startsWith('0x')) {
                  inputContent = inputContent.slice(2);
                }
                const isHex = /^[0-9a-fA-F]+$/.test(inputContent.trim());
                if (isHex && inputContent.length % 2 === 0) {
                  decodedBytes = fromHex(inputContent);
                } else {
                  decodedBytes = fromBase64(txContent);
                }
                const transactionBlock = Transaction.from(decodedBytes);
                console.log('🚀 ~ onClick={ ~ transactionBlock:', account, signAndExecuteTransaction);

                if (!account || !signAndExecuteTransaction) {
                  throw new Error('No account information');
                }

                const sender = transactionBlock.getData().sender;

                if (!sender || !isSameAddress(sender, account.address)) {
                  throw new Error('Transaction sender is not same as the multisig address');
                }

                setProposing(true);

                await signAndExecuteTransaction({
                  transaction: transactionBlock,
                });
              } catch (e) {
                enqueueSnackbar(`Can't propose transaction: ${String(e)}`, { variant: 'error' });
                throw e;
              } finally {
                setProposing(false);
              }
            }}
          >
            Propose
          </Button>
        </Stack>
        <Stack spacing={2}>
          <Typography>Example Code:</Typography>
          <Stack spacing={1} sx={{ borderRadius: 1, border: '1px solid #CCC', p: 2 }}>
            <CopyBlock text={code} language="js" />
          </Stack>
        </Stack>
      </Stack>
    </Container>
  );
}
