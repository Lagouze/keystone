// Helpers for mock data. Every value they produce is fake and visibly marked MOCK.

const DECIMALS = 7n;

/** Whole token units → string in the smallest unit (7 decimals): units(300) === "3000000000". */
export function units(whole: number): string {
  return (BigInt(whole) * 10n ** DECIMALS).toString();
}

/** Fake 56-character Stellar address, not a valid strkey: mockAddress("G", "FUND"). */
export function mockAddress(prefix: "G" | "C", name: string): string {
  return `${prefix}MOCK${name}`.padEnd(56, "X");
}

/** Fake 64-character transaction hash, not a real Testnet transaction: mockTxHash(1). */
export function mockTxHash(n: number): string {
  return `MOCK${String(n).padStart(60, "0")}`;
}
