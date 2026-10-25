// Checks that the mocks respect docs/interfaces.md v1.0 (formats, display rules, vault rules).
import { describe, expect, it } from "vitest";
import type { ActivityEvent, SessionState } from "../src/index.ts";
import {
  mockConfig,
  mockConfirmedDeposit,
  mockPendingDeposit,
  mockScenario1Activity,
  mockSessions,
  units,
} from "../src/mocks/index.ts";

const UNITS = /^\d+$/;
const EUR = /^-?\d+\.\d{2}$/;
const RATE = /^\d+\.\d{3}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

describe("helpers", () => {
  it("converts whole units to the smallest unit (7 decimals)", () => {
    expect(units(300)).toBe("3000000000");
    expect(units(0)).toBe("0");
  });
});

describe("mock config", () => {
  it("lists both assets with 7 decimals and matching id and code", () => {
    expect(mockConfig.assets.map((a) => a.id)).toEqual(["KMMF", "KBOND"]);
    for (const a of mockConfig.assets) {
      expect(a.code).toBe(a.id);
      expect(a.decimals).toBe(7);
      expect(a.haircutPct).toMatch(/^\d+\.\d{2}$/);
    }
  });
});

describe.each(Object.entries(mockSessions))("mock session %s", (status, s: SessionState) => {
  it("has the status of its key", () => {
    expect(s.vault.status).toBe(status);
  });

  it("uses the v1.0 formats", () => {
    const unitFields = [
      s.margin.requiredUnits,
      s.vault.availableUnits,
      s.vault.lockedUnits,
      s.vault.requiredUnits,
      s.vault.shortfallUnits,
      s.balances.fundUnits,
      s.balances.bankUnits,
    ];
    for (const v of unitFields) expect(v).toMatch(UNITS);
    for (const v of [s.swap.notionalEur, s.margin.mtmFundEur, s.margin.requiredValueEur, s.margin.mtaEur]) {
      expect(v).toMatch(EUR);
    }
    expect(s.swap.fixedRatePct).toMatch(RATE);
    expect(s.swap.floatRatePct).toMatch(RATE);
    expect(s.updatedAt).toMatch(ISO);
  });

  it("keeps shortfall = max(0, required - locked) and a deadline only in margin_call", () => {
    const required = BigInt(s.vault.requiredUnits);
    const locked = BigInt(s.vault.lockedUnits);
    const shortfall = required > locked ? required - locked : 0n;
    expect(BigInt(s.vault.shortfallUnits)).toBe(shortfall);
    if (s.vault.status === "margin_call") expect(s.vault.callDeadline).toMatch(ISO);
    else expect(s.vault.callDeadline).toBeNull();
  });
});

describe("mock defaulted session", () => {
  it("has locked = required = shortfall = 0 and keeps the last computed requirement in margin", () => {
    const s = mockSessions.defaulted;
    expect([s.vault.lockedUnits, s.vault.requiredUnits, s.vault.shortfallUnits]).toEqual(["0", "0", "0"]);
    expect(BigInt(s.margin.requiredUnits)).toBeGreaterThan(0n);
  });
});

describe("mock scenario 1 activity", () => {
  const feed: ActivityEvent[] = mockScenario1Activity;

  it("has unique ids, one session and ISO timestamps", () => {
    expect(new Set(feed.map((e) => e.id)).size).toBe(feed.length);
    for (const e of feed) {
      expect(e.sessionId).toBe("mock-session-kmmf");
      expect(e.ts).toMatch(ISO);
    }
  });

  it("never puts a hash on a sim entry", () => {
    for (const e of feed.filter((x) => x.kind === "sim")) {
      expect(e.txHash).toBeUndefined();
      expect(e.explorerUrl).toBeUndefined();
    }
  });

  it("gives every confirmed chain entry a MOCK hash and its explorer link", () => {
    for (const e of feed.filter((x) => x.kind === "chain" && x.status === "confirmed")) {
      expect(e.txHash).toMatch(/^MOCK\d{60}$/);
      expect(e.explorerUrl).toBe(`${mockConfig.explorerTxBase}${e.txHash}`);
    }
  });

  it("models a pending entry updated in place with the same id", () => {
    expect(mockPendingDeposit.id).toBe(mockConfirmedDeposit.id);
    expect(mockPendingDeposit.status).toBe("pending");
    expect(mockPendingDeposit.txHash).toBeUndefined();
    expect(mockConfirmedDeposit.status).toBe("confirmed");
  });
});
