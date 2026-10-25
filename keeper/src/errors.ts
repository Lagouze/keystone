// Error codes of docs/interfaces.md section 4 and contract errors of section 3.6.

export const CONTRACT_ERRORS = [
  "InvalidAmount", "InsufficientAvailable", "StaleEpoch", "AboveCap",
  "NotInMarginCall", "GracePeriodRunning", "NoShortfall", "Defaulted",
] as const;
export type ContractErrorName = (typeof CONTRACT_ERRORS)[number];

export type ApiErrorCode =
  | "BadRequest" | "NoSession" | "SignerModeDisabled" | "TxFailed" | "RpcUnavailable"
  | "NotFound" | "InternalError" | ContractErrorName;

const STATUS: Record<string, number> = {
  BadRequest: 400, NoSession: 404, NotFound: 404, SignerModeDisabled: 409,
  TxFailed: 502, RpcUnavailable: 503, InternalError: 500,
};

export class KeeperError extends Error {
  readonly code: ApiErrorCode;
  readonly httpStatus: number;
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
