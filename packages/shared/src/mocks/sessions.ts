// One SessionState per vault status. Values follow docs/plan.md section 6 with a
// mock starting rate of 2.034 % (K = 2.034 %), N = 10 M EUR, P = 1 000 EUR, h = 2 %.
// The fund starts with 1 000 units of each asset.
import type { SessionState } from "../types";
import { mockAddress, units } from "./helpers";

const swap = (floatRatePct: string): SessionState["swap"] => ({
  notionalEur: "10000000.00",
  fixedRatePct: "2.034",
  floatRatePct,
  floatRateSource: "scenario",
  tenorYears: 5,
  direction: "fund_pays_fixed",
});

const margin = (mtmFundEur: string, requiredValueEur: string, requiredUnits: number): SessionState["margin"] => ({
  mtmFundEur,
  thresholdEur: "0.00",
  mtaEur: "50000.00",
  requiredValueEur,
  unitPriceEur: "1000.00",
  haircutPct: "2.00",
  requiredUnits: units(requiredUnits),
});

/** Scenario 1 (KMMF): 300 units deposited, then a −50 bp shock locks 246 units. */
export const mockSessionActive: SessionState = {
  sessionId: "mock-session-kmmf",
  asset: "KMMF",
  vaultId: mockAddress("C", "VAULTKMMF"),
  updatedAt: "2026-10-25T21:01:05.000Z",
  swap: swap("1.534"),
  margin: margin("-240210.11", "240210.11", 246),
  vault: {
    availableUnits: units(54),
    lockedUnits: units(246),
    requiredUnits: units(246),
    shortfallUnits: units(0),
    status: "active",
    epoch: 1,
    callDeadline: null,
  },
  balances: { fundUnits: units(700), bankUnits: units(0) },
};

/** Scenario 1 (KMMF): a further −30 bp shock (−80 bp in total) requires 396 units; 96 are missing. */
export const mockSessionMarginCall: SessionState = {
  ...mockSessionActive,
  updatedAt: "2026-10-25T21:02:05.000Z",
  swap: swap("1.234"),
  margin: margin("-387331.01", "387331.01", 396),
  vault: {
    availableUnits: units(0),
    lockedUnits: units(300),
    requiredUnits: units(396),
    shortfallUnits: units(96),
    status: "margin_call",
    epoch: 2,
    callDeadline: "2026-10-25T21:03:35.000Z", // confirmation time + 90 s grace period
  },
};

/** Scenario 2 (KBOND): 300 units deposited, −100 bp requires 497, no top-up, 300 units settled to the bank. */
export const mockSessionDefaulted: SessionState = {
  sessionId: "mock-session-kbond",
  asset: "KBOND",
  vaultId: mockAddress("C", "VAULTKBOND"),
  updatedAt: "2026-10-25T21:12:00.000Z",
  swap: swap("1.034"),
  // Frozen after the default: last computed requirement (historical).
  margin: margin("-486682.24", "486682.24", 497),
  vault: {
    availableUnits: units(0),
    lockedUnits: units(0),
    requiredUnits: units(0),
    shortfallUnits: units(0),
    status: "defaulted",
    epoch: 1,
    callDeadline: null,
  },
  balances: { fundUnits: units(700), bankUnits: units(300) },
};

export const mockSessions = {
  active: mockSessionActive,
  margin_call: mockSessionMarginCall,
  defaulted: mockSessionDefaulted,
} satisfies Record<SessionState["vault"]["status"], SessionState>;
