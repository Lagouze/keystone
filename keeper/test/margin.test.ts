import { describe, expect, it } from "vitest";
import {
  annuityFactor, collateralParams, computeMargin, fixedRateFromStart, shouldPost, valueToUnits,
  type SwapParams,
} from "../src/margin.ts";

// Reference values were computed outside the code under test, in Python with 50-digit decimals,
// from the formulas of docs/plan.md section 6: start rate 2.034 %, K = 2.030 %, N = 10 000 000 EUR,
// 20 quarterly periods, threshold 0, KMMF at 1 000 EUR with a 2 % haircut.
const START = 2034;
const swap: SwapParams = { notionalEur: 10_000_000n, fixedRateMilli: fixedRateFromStart(START), tenorYears: 5 };
const kmmf = collateralParams("0", "1000.00", "2.00");

describe("fixed rate", () => {
  it("rounds the starting rate to the basis point", () => {
    expect(fixedRateFromStart(2034)).toBe(2030);
    expect(fixedRateFromStart(2035)).toBe(2040);
    expect(fixedRateFromStart(-250)).toBe(-250);
  });
});

describe("annuity factor", () => {
  it("matches the reference value at 2.034 %", () => {
    expect(annuityFactor(2034, 5)).toBeCloseTo(4.7427084157144, 10);
  });
});

describe("computeMargin", () => {
  const cases = [
    { bp: 0, mtm: 189_708n, v: 0n, q: 0n },
    { bp: -50, mtm: -23_828_843n, v: 23_828_843n, q: 2_431_514_592n },
    { bp: -80, mtm: -38_539_436n, v: 38_539_436n, q: 3_932_595_511n },
    { bp: -100, mtm: -48_473_551n, v: 48_473_551n, q: 4_946_280_715n },
    { bp: 60, mtm: 28_209_030n, v: 0n, q: 0n },
  ];
  for (const c of cases) {
    it(`${c.bp} bp`, () => {
      const r = computeMargin(swap, START + c.bp * 10, kmmf);
      expect(r.mtmFundCents).toBe(c.mtm);
      expect(r.requiredValueCents).toBe(c.v);
      expect(r.requiredUnits).toBe(c.q);
    });
  }

  it("-50 bp locks about 243 units, as in scenario 1", () => {
    expect(computeMargin(swap, START - 500, kmmf).requiredUnits / 10_000_000n).toBe(243n);
  });

  it("subtracts the threshold", () => {
    const r = computeMargin(swap, START - 500, collateralParams("100000", "1000.00", "2.00"));
    expect(r.requiredValueCents).toBe(13_828_843n);
    expect(r.requiredUnits).toBe(1_411_106_429n);
  });

  it("uses the asset price and haircut", () => {
    const r = computeMargin(swap, START - 500, collateralParams("0", "500.00", "5.00"));
    expect(r.requiredUnits).toBe(5_016_598_527n);
  });

  it("handles a negative float rate", () => {
    const negative: SwapParams = { ...swap, fixedRateMilli: fixedRateFromStart(-250) };
    const r = computeMargin(negative, -250 - 500, kmmf);
    expect(r.mtmFundCents).toBe(-25_499_029n);
    expect(r.requiredUnits).toBe(2_601_941_735n);
  });

  it("rejects a rate that makes the discount factor invalid", () => {
    expect(() => computeMargin(swap, -400_000, kmmf)).toThrow();
  });
});

describe("rounding goes in the prudent direction", () => {
  it("rounds Q up to the next unit", () => {
    // 1 cent needs 0.01 / 980 * 1e7 = 102.04 smallest units, rounded up to 103
    expect(valueToUnits(1n, kmmf)).toBe(103n);
    // exactly 980 EUR is exactly 1 unit (1e7 smallest units): no extra unit; 980.01 EUR is 10 000 102.04, rounded up
    expect(valueToUnits(98_000n, kmmf)).toBe(10_000_000n);
    expect(valueToUnits(98_001n, kmmf)).toBe(10_000_103n);
    expect(valueToUnits(0n, kmmf)).toBe(0n);
  });
});

describe("MTA rule", () => {
  const mta = 5_000_000n; // 50 000.00 EUR
  it("posts only when V moved by at least the MTA", () => {
    expect(shouldPost(0n, 4_999_999n, mta)).toBe(false);
    expect(shouldPost(0n, 5_000_000n, mta)).toBe(true);
    expect(shouldPost(10_000_000n, 5_000_001n, mta)).toBe(false);
    expect(shouldPost(10_000_000n, 5_000_000n, mta)).toBe(true);
    expect(shouldPost(10_000_000n, 0n, mta)).toBe(true);
  });
});
