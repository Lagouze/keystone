// Activity feed of scenario 1 (KMMF), in order. Entries produced by the same
// transaction share the same mock hash. All hashes are fake and start with MOCK.
import type { ActivityEvent } from "../types";
import { mockConfig } from "./config";
import { mockTxHash } from "./helpers";

const sessionId = "mock-session-kmmf";

const sim = (id: string, ts: string, title: string, detail: string): ActivityEvent => ({
  id,
  sessionId,
  ts,
  kind: "sim",
  type: "rate_shock",
  title,
  detail,
  status: "confirmed",
});

const chain = (
  id: string,
  ts: string,
  type: ActivityEvent["type"],
  title: string,
  tx: number,
  detail?: string,
): ActivityEvent => ({
  id,
  sessionId,
  ts,
  kind: "chain",
  type,
  title,
  ...(detail === undefined ? {} : { detail }),
  status: "confirmed",
  txHash: mockTxHash(tx),
  explorerUrl: `${mockConfig.explorerTxBase}${mockTxHash(tx)}`,
});

export const mockScenario1Activity: ActivityEvent[] = [
  chain("s1-01", "2026-10-25T21:00:05.000Z", "session_started", "Vault deployed for KMMF", 1),
  chain("s1-02", "2026-10-25T21:00:25.000Z", "deposit", "Fund deposited 300 KMMF", 2),
  sim("s1-03", "2026-10-25T21:01:00.000Z", "Rate shock −50 bp", "Euribor 3M 2.034 % → 1.534 %; requirement 240 210.11 EUR = 246 KMMF"),
  chain("s1-04", "2026-10-25T21:01:05.000Z", "margin_set", "Requirement posted: 246 KMMF locked", 3, "Epoch 1"),
  sim("s1-05", "2026-10-25T21:02:00.000Z", "Rate shock −30 bp", "Euribor 3M 1.534 % → 1.234 %; requirement 387 331.01 EUR = 396 KMMF"),
  chain("s1-06", "2026-10-25T21:02:05.000Z", "margin_set", "Requirement posted: 396 KMMF, 300 locked", 4, "Epoch 2"),
  chain("s1-07", "2026-10-25T21:02:05.000Z", "margin_call", "Margin call: 96 KMMF missing", 4, "Deadline 21:03:35 UTC"),
  chain("s1-08", "2026-10-25T21:02:45.000Z", "deposit", "Fund deposited 100 KMMF", 5),
  chain("s1-09", "2026-10-25T21:02:45.000Z", "cured", "Margin call cured", 5),
  sim("s1-10", "2026-10-25T21:03:30.000Z", "Rate shock +60 bp", "Euribor 3M 1.234 % → 1.834 %; requirement 95 343.45 EUR = 98 KMMF"),
  chain("s1-11", "2026-10-25T21:03:35.000Z", "margin_set", "Requirement posted: 98 KMMF locked", 6, "Epoch 3"),
  chain("s1-12", "2026-10-25T21:03:35.000Z", "released", "298 KMMF released", 6),
  chain("s1-13", "2026-10-25T21:04:05.000Z", "withdraw", "Fund withdrew 300 KMMF", 7),
];

/** A chain entry while its transaction is pending, then the same entry once confirmed (same id). */
export const mockPendingDeposit: ActivityEvent = {
  id: "s1-02",
  sessionId,
  ts: "2026-10-25T21:00:20.000Z",
  kind: "chain",
  type: "deposit",
  title: "Fund deposited 300 KMMF",
  status: "pending",
};

export const mockConfirmedDeposit: ActivityEvent = mockScenario1Activity[1]!;
