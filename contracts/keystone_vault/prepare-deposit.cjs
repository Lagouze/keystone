// Prepare a fresh, unsigned Testnet deposit for the configured project fund.
// This script never loads a signing identity, signs, or submits a transaction.
const {
  Networks,
  TransactionBuilder,
  Operation,
  nativeToScVal,
  Horizon,
  rpc,
} = require('../../packages/vault-client/node_modules/@stellar/stellar-sdk');

const proof = require('./testnet-c1.json');

async function main() {
  if (proof.network !== 'testnet' || proof.networkPassphrase !== Networks.TESTNET) {
    throw new Error('Testnet configuration required');
  }
  const horizon = new Horizon.Server('https://horizon-testnet.stellar.org');
  const server = new rpc.Server('https://soroban-testnet.stellar.org');
  const account = await horizon.loadAccount(proof.constructor.fund);
  const tx = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.invokeContractFunction({
      contract: proof.vaultId,
      function: 'deposit',
      args: [nativeToScVal(10_000_000n, { type: 'i128' })],
    }))
    .setTimeout(180)
    .build();

  const simulation = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(`Deposit simulation failed: ${simulation.error}`);
  }
  const prepared = rpc.assembleTransaction(tx, simulation).build();
  if (prepared.source !== proof.constructor.fund || prepared.signatures.length !== 0) {
    throw new Error('Expected an unsigned transaction sourced by the project fund');
  }
  console.error('Unsigned deposit: 1 KMMF (10000000 base units), fund authorization required.');
  console.error('Expires in 180 seconds; regenerate if expired or the fund sequence changes.');
  console.log(prepared.toXDR());
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
