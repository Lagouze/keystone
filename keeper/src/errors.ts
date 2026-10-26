// Error codes of docs/interfaces.md section 4 and contract errors of section 3.6.

export const CONTRACT_ERRORS = [
  "InvalidAmount", "InsufficientAvailable", "StaleEpoch", "AboveCap",
  "NotInMarginCall", "GracePeriodRunning", "NoShortfall", "Defaulted",
] as const;
export type ContractErrorName = (typeof CONTRACT_ERRORS)[number];

export type ApiErrorCode =
  | "BadRequest" | "NoSession" | "SignerModeDisabled" | "TxFailed" | "RpcUnavailable"
  | "Unauthorized" | "PendingTransaction" | "NotFound" | "InternalError" | ContractErrorName;

const STATUS: Record<string, number> = {
  BadRequest: 400, Unauthorized: 401, NoSession: 404, NotFound: 404, SignerModeDisabled: 409, PendingTransaction: 409,
  TxFailed: 502, RpcUnavailable: 503, InternalError: 500,
};

export class KeeperError extends Error {
  readonly code: ApiErrorCode;
  readonly httpStatus: number;
  /** Set when the transaction was sent but its outcome is unknown (RpcUnavailable): the key to reconcile it later. */
  txHash?: string;
  /** Deploy only: the vault the unconfirmed transaction creates. */
  vaultId?: string;
  /** The network refused the transaction before including it: nothing to reconcile. */
  notSent?: boolean;
  /** The transaction was included and failed on-chain: a definite outcome. */
  onChain?: boolean;
  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.name = "KeeperError";
    this.code = code;
    this.httpStatus = STATUS[code] ?? 409; // every remaining code is a contract error
  }
}

/** The vault rejected the call for a business reason (section 3.6). */
export class VaultError extends KeeperError {
  constructor(code: ContractErrorName, message?: string) {
    super(code, message ?? `The vault rejected the call: ${code}`);
  }
}

/** True only when the chain says the vault does not exist (after a Testnet reset, for example): never for a network trouble. */
export function isVaultGone(e: unknown): boolean {
  return e instanceof KeeperError && e.code === "TxFailed" && /MissingValue|non-existing value for contract instance|Unknown vault/i.test(e.message);
}
