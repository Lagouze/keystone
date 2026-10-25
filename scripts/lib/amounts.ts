// Exact conversions between classic Stellar amounts ("1000.0000000") and the smallest
// unit (stroops, 7 decimals), without going through a JS number.

const DECIMALS = 7;

export function toSmallest(amount: string): bigint {
  const m = /^(\d+)(?:\.(\d{1,7}))?$/.exec(amount);
  if (!m) throw new Error(`Invalid Stellar amount: ${amount}`);
  return BigInt(m[1]!) * 10n ** BigInt(DECIMALS) + BigInt((m[2] ?? "").padEnd(DECIMALS, "0"));
}

export function fromSmallest(units: bigint): string {
  if (units < 0n) throw new Error("Negative amount");
  const s = units.toString().padStart(DECIMALS + 1, "0");
  return `${s.slice(0, -DECIMALS)}.${s.slice(-DECIMALS)}`;
}
