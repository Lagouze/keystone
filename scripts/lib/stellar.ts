// Stellar Testnet helpers for the scripts. Testnet only (docs/interfaces.md section 1).
// Logs contain public keys and transaction hashes only, never a secret.
import {
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  NotFoundError,
  Operation,
  TransactionBuilder,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";
import type { AssetId } from "@keystone/shared";

export const TESTNET = {
  networkPassphrase: "Test SDF Network ; September 2015",
  rpcUrl: "https://soroban-testnet.stellar.org",
  horizonUrl: "https://horizon-testnet.stellar.org",
  explorerTxBase: "https://stellar.expert/explorer/testnet/tx/",
} as const;

/** Asset codes of docs/interfaces.md section 2: the AssetId equals the on-chain code. */
export const ASSET_CODES: Record<AssetId, string> = { KMMF: "KMMF", KBOND: "KBOND" };

export const horizon = new Horizon.Server(TESTNET.horizonUrl);
export const soroban = new rpc.Server(TESTNET.rpcUrl);

/** Loads an account from Horizon, or returns null when it does not exist yet. */
export async function loadAccountOrNull(publicKey: string): Promise<Horizon.AccountResponse | null> {
  try {
    return await horizon.loadAccount(publicKey);
  } catch (e) {
    if (e instanceof NotFoundError) return null;
    throw e;
  }
}

/** Creates the account with friendbot when it does not exist. */
export async function ensureAccount(publicKey: string): Promise<{ account: Horizon.AccountResponse; created: boolean }> {
  const existing = await loadAccountOrNull(publicKey);
  if (existing) return { account: existing, created: false };
  await horizon.friendbot(publicKey).call();
  return { account: await horizon.loadAccount(publicKey), created: true };
}

export function balanceOf(account: Horizon.AccountResponse, asset: Asset): string | null {
  for (const b of account.balances) {
    if ((b.asset_type === "credit_alphanum4" || b.asset_type === "credit_alphanum12")
      && b.asset_code === asset.getCode() && b.asset_issuer === asset.getIssuer()) {
      return b.balance;
    }
  }
  return null;
}

/** Submits one classic operation signed by `signer`, and returns the transaction hash. */
export async function submitClassic(signer: Keypair, op: xdr.Operation): Promise<string> {
  const source = await horizon.loadAccount(signer.publicKey());
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: TESTNET.networkPassphrase })
    .addOperation(op)
    .setTimeout(60)
    .build();
  tx.sign(signer);
  try {
    const res = await horizon.submitTransaction(tx);
    return res.hash;
  } catch (e) {
    // Horizon result codes are public and say why the ledger rejected the transaction.
    const codes = (e as { response?: { data?: { extras?: { result_codes?: unknown } } } }).response?.data?.extras?.result_codes;
    if (codes) throw new Error(`Transaction ${Buffer.from(tx.hash()).toString("hex")} rejected by Horizon: ${JSON.stringify(codes)}`);
    throw e;
  }
}

/** Adds a trustline on `asset` for `holder` if it is missing. */
export async function ensureTrustline(holder: Keypair, asset: Asset): Promise<string | null> {
  const account = await horizon.loadAccount(holder.publicKey());
  if (balanceOf(account, asset) !== null) return null;
  return submitClassic(holder, Operation.changeTrust({ asset }));
}

/** True when the Stellar Asset Contract of `asset` is already deployed. */
export async function sacExists(contractId: string): Promise<boolean> {
  try {
    await soroban.getContractData(contractId, xdr.ScVal.scvLedgerKeyContractInstance(), rpc.Durability.Persistent);
    return true;
  } catch (e) {
    // The RPC client rejects with a plain { code: 404, message } object when the entry is missing.
    if (typeof e === "object" && e !== null && (e as { code?: unknown }).code === 404) return false;
    throw e;
  }
}

/**
 * Deploys the Stellar Asset Contract of `asset` if needed. The contract ID is
 * deterministic, so a second run only reads it.
 */
export async function ensureSac(payer: Keypair, asset: Asset): Promise<{ contractId: string; txHash: string | null }> {
  const contractId = asset.contractId(TESTNET.networkPassphrase);
  if (await sacExists(contractId)) return { contractId, txHash: null };

  const source = await soroban.getAccount(payer.publicKey());
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: TESTNET.networkPassphrase })
    .addOperation(Operation.createStellarAssetContract({ asset }))
    .setTimeout(60)
    .build();
  const prepared = await soroban.prepareTransaction(tx);
  prepared.sign(payer);
  const sent = await soroban.sendTransaction(prepared);
  if (sent.status === "ERROR" || sent.status === "TRY_AGAIN_LATER") {
    throw new Error(`SAC deployment for ${asset.getCode()} rejected: ${sent.status}`);
  }
  const result = await soroban.pollTransaction(sent.hash, { attempts: 30 });
  if (result.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(`SAC deployment for ${asset.getCode()} failed: ${result.status} (${sent.hash})`);
  }
  return { contractId, txHash: sent.hash };
}

/** Parses a secret key from the environment, with an error message that never contains the value. */
export function keypairFromEnv(name: string, value: string | undefined): Keypair | null {
  if (!value) return null;
  try {
    return Keypair.fromSecret(value);
  } catch {
    throw new Error(`${name} in .env is not a valid Stellar secret key`);
  }
}
