// Boundary between the keeper and the Soroban vault. The keeper logic only talks to this
// interface; the in-memory fake implements it today, and the client built on
// packages/vault-client will implement it once the contract is merged.

export type OnChainStatus = "Active" | "MarginCall" | "Defaulted";

/** `VaultState` of docs/interfaces.md section 3.1, amounts as bigint, `*_secs` and timestamps as bigint. */
export interface VaultState {
  fund: string;
  bank: string;
  keeper: string;
  asset: string;
  available: bigint;
  locked: bigint;
  required: bigint;
  shortfall: bigint;
  status: OnChainStatus;
  epoch: bigint;
  callDeadline: bigint;       // ledger timestamp in seconds, 0 outside a margin call
  gracePeriodSecs: bigint;
  maxRequired: bigint;
}

/** Events of section 3.5, as read from a confirmed transaction. */
export type VaultEvent =
  | { type: "deposited"; amount: bigint }
  | { type: "withdrawn"; amount: bigint }
  | { type: "margin_set"; epoch: bigint; required: bigint; locked: bigint; shortfall: bigint }
  | { type: "margin_call"; callDeadline: bigint }
  | { type: "cured" }
  | { type: "defaulted"; amount: bigint };

/** A confirmed transaction: its hash, its events and the vault state right after it. */
export interface TxResult {
  txHash: string;
  events: VaultEvent[];
  state: VaultState;
}

export interface DeployParams {
  fund: string;
  bank: string;
  keeper: string;
  assetSac: string;
  maxRequired: bigint;
  gracePeriodSecs: bigint;
}

export interface SignedTxInfo {
  action: "deposit" | "withdraw";
  units: bigint;
  /** Hash of the signed transaction, known before it is sent (absent on the in-memory vault). */
  txHash?: string;
}

/** Outcome of a transaction looked up by hash. NOT_FOUND: not (yet) included in a ledger. */
export type TxStatus = "SUCCESS" | "FAILED" | "NOT_FOUND";

/**
 * Failures: a business rejection throws `VaultError` (409, section 3.6); a rejection outside the
 * vault's rules throws `KeeperError("TxFailed")`; an unreachable RPC or a missing confirmation
 * after 60 s throws `KeeperError("RpcUnavailable")`. Each method resolves once the transaction is
 * confirmed.
 */
export interface VaultClient {
  /** Looks a transaction up by hash; used to settle entries left pending by a timeout. */
  txStatus(hash: string): Promise<TxStatus>;
  /** Ledger time in seconds: the authority for deadlines. */
  ledgerTime(): Promise<bigint>;
  deploy(params: DeployParams): Promise<{ vaultId: string; txHash: string }>;
  getState(vaultId: string): Promise<VaultState>;
  /** Token balances of the fund and the bank in the vault's asset. */
  balances(vaultId: string): Promise<{ fund: bigint; bank: bigint }>;

  // Transactions signed by the keeper.
  postMargin(vaultId: string, epoch: bigint, required: bigint): Promise<TxResult>;
  settleDefault(vaultId: string): Promise<TxResult>;
  /** SIGNER=keeper: the keeper signs with the demo fund key. */
  deposit(vaultId: string, units: bigint): Promise<TxResult>;
  withdraw(vaultId: string, units: bigint): Promise<TxResult>;

  // SIGNER=freighter: the keeper prepares, the fund signs in the wallet, the keeper submits.
  prepare(vaultId: string, action: "deposit" | "withdraw", units: bigint): Promise<string>;
  inspectSigned(signedTxXdr: string): SignedTxInfo;
  submitSigned(vaultId: string, signedTxXdr: string): Promise<TxResult>;
}
