// Amount conversions and display formatting. Token amounts stay BigInt end to end
// (docs/interfaces.md section 4: `*Units` are integers in the token's smallest unit).

const MINUS = '−'

/** Parses a user amount ("300", "12.5") into smallest units. Throws a readable Error when invalid. */
export function parseUnits(input: string, decimals: number): string {
  const text = input.trim().replace(/[,\s]/g, '')
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text)
  if (!match) throw new Error('Enter a positive amount, for example 300.')
  const [, whole, fraction = ''] = match
  if (fraction.length > decimals) throw new Error(`Use at most ${decimals} decimals.`)
  const value = BigInt(whole!) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, '0') || '0')
  if (value <= 0n) throw new Error('Enter an amount greater than zero.')
  return value.toString()
}

/** Smallest units → "1,234.5" (trailing zeros trimmed, at most `maxFraction` digits, rounded down). */
export function formatUnits(units: string, decimals: number, maxFraction = 2): string {
  const value = BigInt(units)
  const negative = value < 0n
  const abs = negative ? -value : value
  const base = 10n ** BigInt(decimals)
  const whole = (abs / base).toLocaleString('en-US')
  const fraction = (abs % base)
    .toString()
    .padStart(decimals, '0')
    .slice(0, maxFraction)
    .replace(/0+$/, '')
  return `${negative ? MINUS : ''}${whole}${fraction ? `.${fraction}` : ''}`
}

/** Smallest units → approximate number, for proportions only (never for amounts sent to the keeper). */
export function unitsToNumber(units: string, decimals: number): number {
  return Number(BigInt(units)) / 10 ** decimals
}

/** "-240210.11" → "−240,210.11" */
export function formatEur(value: string): string {
  const number = Number(value)
  const text = Math.abs(number).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return number < 0 ? `${MINUS}${text}` : text
}

/** "2.034" → "2.034%" */
export function formatPct(value: string): string {
  return `${value}%`
}

/** Remaining time as "m:ss", or null once the deadline has passed. */
export function formatCountdown(deadline: string, now: number): string | null {
  const ms = Date.parse(deadline) - now
  if (ms <= 0) return null
  const total = Math.ceil(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** ISO timestamp → local "21:02:05" */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour12: false })
}

/** "GABC…WXYZ" */
export function shortAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 4)}…${address.slice(-4)}` : address
}
