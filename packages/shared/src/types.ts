// Keystone shared types — exact copy of docs/interfaces.md, section 5.
// Do not edit here without updating docs/interfaces.md in the same PR.

export type AssetId = "KMMF" | "KBOND"; // both fictitious, issued by the team on Testnet
export type VaultStatus = "active" | "margin_call" | "defaulted";
export type SignerMode = "freighter" | "keeper";

export interface AssetInfo {
  id: AssetId;
  code: string;          // "KMMF" | "KBOND"
  issuer: string;        // G... address of the team issuer
  sac: string;           // C... SAC contract ID
  decimals: number;      // 7
  label: string;         // human-readable name shown in the UI
  unitPriceEur: string;  // simulated
  haircutPct: string;    // percent, "2.00" = 2 %
}

export interface KeystoneConfig {
  network: "testnet";
  networkPassphrase: string;
  explorerTxBase: string; // "https://stellar.expert/explorer/testnet/tx/"
  accounts: { fund: string; bank: string; keeper: string };
  assets: AssetInfo[];
  signerMode: SignerMode;
  /** Optional (v1.3): which vault backs the keeper. "fake" means no real transaction. */
  backend?: "testnet" | "fake";
  /** Optional (v1.3): "token" when the write routes need `Authorization: Bearer <access code>`. */
  writeAuth?: "token" | "none";
}

export interface SessionState {
  sessionId: string;
  asset: AssetId;
  vaultId: string;        // C... contract ID of this session's vault
  updatedAt: string;      // ISO 8601
  swap: {
    notionalEur: string;
    fixedRatePct: string;   // percent, 3 decimals
    floatRatePct: string;   // percent, 3 decimals
    floatRateSource: "ecb" | "cache" | "scenario";
    tenorYears: number;
    direction: "fund_pays_fixed";
  };
  margin: {
    mtmFundEur: string;     // negative when the fund loses
    thresholdEur: string;
    mtaEur: string;
    requiredValueEur: string;
    unitPriceEur: string;
    haircutPct: string;
    requiredUnits: string;  // last computed Q, may differ from vault.requiredUnits under the MTA
  };
  vault: {
    availableUnits: string;
    lockedUnits: string;
    requiredUnits: string;
    shortfallUnits: string;
    status: VaultStatus;
    epoch: number;
    callDeadline: string | null; // ISO 8601, null outside a margin call
  };
  balances: { fundUnits: string; bankUnits: string }; // in the session's asset
}

export type ActivityType =
  | "session_started" | "deposit" | "withdraw" | "rate_shock" | "margin_set"
  | "margin_call" | "cured" | "released" | "defaulted" | "error";

export interface ActivityEvent {
  id: string;
  sessionId: string;             // session that produced the entry
  ts: string;                    // ISO 8601
  kind: "sim" | "chain";         // local computation or real Testnet transaction
  type: ActivityType;
  title: string;
  detail?: string;
  status: "pending" | "confirmed" | "failed";
  txHash?: string;               // required when kind = "chain" and status = "confirmed"
  explorerUrl?: string;          // required when kind = "chain" and status = "confirmed"
}

export interface ApiError {
  error: { code: string; message: string };
}
