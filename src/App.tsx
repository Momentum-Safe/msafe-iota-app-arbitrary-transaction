import { Button, PageHeader, TextField, shortAddress } from '@msafe/msafe-ui';
import { MSafeWallet } from '@msafe/iota-wallet';
import { isSameAddress } from '@msafe/iota-utils';
import { CheckCircle } from '@mui/icons-material';
import { Box, Container, Stack, Typography } from '@mui/material';
import {
  useConnectWallet,
  useCurrentAccount,
  useCurrentWallet,
  useDisconnectWallet,
  useIotaClient,
} from '@iota/dapp-kit';
import { TransactionBlock } from '@iota/iota-sdk/transactions';
import { fromHEX } from '@iota/iota-sdk/utils';
import { useSnackbar } from 'notistack';
import { useEffect, useMemo, useState } from 'react';
import { CopyBlock } from 'react-code-blocks';
const code = `import { TransactionBlock } from '@iota/iota-sdk/transactions';
import { toHEX } from '@iota/iota-sdk/utils';

const txb = new TransactionBlock();
// Your build logic here
const txBytes = txb.build();
// Copy below txHex content to input
const txHex = toHEX(txBytes);`;

export default function App() {
  const { mutate: disconnect } = useDisconnectWallet();
  const { mutate: connect } = useConnectWallet();

  const { enqueueSnackbar } = useSnackbar();

  const iotaClient = useIotaClient();
  const wallet = useCurrentWallet();
  const account = useCurrentAccount();

  const [txContent, setTxContent] = useState('');
  const [proposing, setProposing] = useState(false);

  const connectWallet = () => {
    connect({
      wallet: new MSafeWallet('msafe-plain-tx', iotaClient, 'sui:testnet'),
      silent: true,
    });
  };

  useEffect(() => {
    connectWallet();
  }, []);

  const signAndExecuteTransactionBlock = useMemo(() => {
    if (!wallet.currentWallet) {
      return null;
    }
    const feature = wallet.currentWallet.features['sui:signAndExecuteTransactionBlock'];
    if (!feature) {
      return null;
    }
    return (feature as any).signAndExecuteTransactionBlock;
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
          placeholder="Please input your transaction block BASE-64 encoding content."
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
            color="primary"
            disabled={!wallet.isConnected}
            loading={proposing}
            onClick={async () => {
              try {
                const transactionBlock = TransactionBlock.from(fromHEX(txContent));

                if (!account || !signAndExecuteTransactionBlock) {
                  throw new Error('No account information');
                }

                if (
                  !transactionBlock.blockData.sender ||
                  !isSameAddress(transactionBlock.blockData.sender, account.address)
                ) {
                  throw new Error('Transaction sender is not same as the multisig address');
                }

                setProposing(true);

                await signAndExecuteTransactionBlock({
                  transactionBlock,
                  account,
                  chain: account.chains[0],
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
