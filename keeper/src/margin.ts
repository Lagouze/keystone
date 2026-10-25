// Margin model of docs/plan.md section 6: flat curve at rate r, quarterly payments.
//
//   A(r)      = sum_{i=1..20} 0.25 / (1 + r/4)^i
//   MTM_fund  = N * (r - K) * A(r)
//   V         = max(0, -MTM_fund - threshold)
//   Q         = ceil( V / (P * (1 - h)) )     in the token's smallest unit
//
// Rates are integers in thousandths of a percent ("milli"): 2.034 % = 2034, 1 bp = 10.
// Money is in euro cents (bigint). Both roundings go in the prudent direction: the fund's loss is
// rounded away from zero to the cent, and Q is rounded up to the next unit.
import { DECIMALS, parseScaled } from "./amounts.ts";

export const MILLI_PER_BP = 10;
const PERIODS = 20;

export interface SwapParams {
  notionalEur: bigint;       // whole euros
  fixedRateMilli: number;    // K
  tenorYears: number;        // 5, quarterly payments
}

export interface CollateralParams {
  thresholdCents: bigint;
  unitPriceCents: bigint;    // P
  haircutHundredths: bigint; // h in hundredths of a percent: 2 % = 200
}

export interface MarginResult {
  mtmFundCents: bigint;      // negative when the fund loses
  requiredValueCents: bigint; // V
  requiredUnits: bigint;     // Q
}

/** Annuity factor A(r) for a quarterly flat curve. */
export function annuityFactor(rateMilli: number, tenorYears: number): number {
  const q = 1 + rateMilli / 100_000 / 4;
  let a = 0;
  for (let i = 1; i <= tenorYears * 4; i++) a += 0.25 / q ** i;
  return a;
}

/** K: the starting float rate rounded to the basis point (half up), as thousandths of a percent. */
export function fixedRateFromStart(startMilli: number): number {
  return Math.round(startMilli / MILLI_PER_BP) * MILLI_PER_BP;
}

export function computeMargin(swap: SwapParams, floatRateMilli: number, c: CollateralParams): MarginResult {
  if (c.unitPriceCents <= 0n || c.haircutHundredths < 0n || c.haircutHundredths >= 10_000n) {
    throw new Error("Invalid collateral parameters");
  }
  const rate = floatRateMilli / 100_000;
  if (!(1 + rate / 4 > 0)) throw new Error(`Float rate out of range: ${floatRateMilli}`);
  const mtmEur = Number(swap.notionalEur) * ((floatRateMilli - swap.fixedRateMilli) / 100_000) * annuityFactor(floatRateMilli, swap.tenorYears);
  const mtmFundCents = BigInt(Math.floor(mtmEur * 100)); // prudent: a loss is rounded away from zero
  const requiredValueCents = maxBig(0n, -mtmFundCents - c.thresholdCents);
  return { mtmFundCents, requiredValueCents, requiredUnits: valueToUnits(requiredValueCents, c) };
}

/** Q = ceil(V / (P (1 - h))) in smallest units, with exact integer arithmetic. */
export function valueToUnits(valueCents: bigint, c: CollateralParams): bigint {
  const num = valueCents * 10_000n * 10n ** BigInt(DECIMALS);
  const den = c.unitPriceCents * (10_000n - c.haircutHundredths);
  return (num + den - 1n) / den;
}

/** MTA rule: publish only if V moved by at least the MTA since the last publication. */
export function shouldPost(lastPostedValueCents: bigint, newValueCents: bigint, mtaCents: bigint): boolean {
  const moved = newValueCents - lastPostedValueCents;
  return (moved < 0n ? -moved : moved) >= mtaCents;
}

export function collateralParams(
  thresholdEur: string,
  unitPriceEur: string,
  haircutPct: string,
): CollateralParams {
  return {
    thresholdCents: parseScaled(thresholdEur, 2),
    unitPriceCents: parseScaled(unitPriceEur, 2),
    haircutHundredths: parseScaled(haircutPct, 2),
  };
}

function maxBig(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}
