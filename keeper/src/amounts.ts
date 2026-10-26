// Exact decimal helpers. Amounts never go through a JS number (docs/interfaces.md section 4).

export const DECIMALS = 7;
const UNIT = 10n ** BigInt(DECIMALS);

/** Smallest units (7 decimals) to a plain decimal string: 3000000000n -> "300.0000000". */
export function formatUnits(units: bigint): string {
  const negative = units < 0n;
  const s = (negative ? -units : units).toString().padStart(DECIMALS + 1, "0");
  return `${negative ? "-" : ""}${s.slice(0, -DECIMALS)}.${s.slice(-DECIMALS)}`;
}

/** Hundredths (euro cents, or hundredths of a percent) to "1234.56". */
export function formatCents(cents: bigint): string {
  const negative = cents < 0n;
  const s = (negative ? -cents : cents).toString().padStart(3, "0");
  return `${negative ? "-" : ""}${s.slice(0, -2)}.${s.slice(-2)}`;
}

/** A rate in thousandths of a percent to "2.034" (3 decimals). */
export function formatMilli(milli: number): string {
  const negative = milli < 0;
  const s = Math.abs(milli).toString().padStart(4, "0");
  return `${negative ? "-" : ""}${s.slice(0, -3)}.${s.slice(-3)}`;
}

/** Parses a non-negative decimal with at most `decimals` digits into an integer scaled by 10^decimals. */
export function parseScaled(value: string, decimals: number): bigint {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(value);
  if (!m || (m[2] ?? "").length > decimals) throw new Error(`Invalid decimal "${value}" (max ${decimals} decimals)`);
  return BigInt(m[1]! + (m[2] ?? "").padEnd(decimals, "0"));
}

/** Parses a signed decimal into thousandths, rounding half away from zero beyond 3 decimals. */
export function parseMilli(value: string): number {
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!m) throw new Error(`Invalid rate "${value}"`);
  const digits = (m[3] ?? "").padEnd(4, "0");
  const scaled = BigInt(m[2]! + digits.slice(0, 3)) + (digits.charCodeAt(3) >= 53 ? 1n : 0n);
  return Number(m[1] ? -scaled : scaled);
}
