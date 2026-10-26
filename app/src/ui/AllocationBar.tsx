import { motion } from 'motion/react'

interface AllocationBarProps {
  /** Amounts in the token's smallest unit, as sent by the keeper (`*Units` strings). */
  available: string
  locked: string
  shortfall: string
  /** Text read by screen readers, with formatted amounts and their unit. */
  label: string
}

const SEGMENTS = [
  { key: 'locked', label: 'Locked', className: 'bg-chain' },
  { key: 'available', label: 'Available', className: 'bg-chain-light' },
  { key: 'shortfall', label: 'Shortfall', className: 'bg-warning' },
] as const

/** Share of `part` in `total` as a percentage, computed in BigInt (0.01 % precision). */
function share(part: string, total: bigint): number {
  return total === 0n ? 0 : Number((BigInt(part) * 10_000n) / total) / 100
}

export function AllocationBar(props: AllocationBarProps) {
  const total = BigInt(props.available) + BigInt(props.locked) + BigInt(props.shortfall)
  return (
    <div>
      <div
        className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-surface-muted"
        role="img"
        aria-label={props.label}
      >
        {SEGMENTS.map((s) => (
          <motion.div
            key={s.key}
            className={s.className}
            initial={false}
            animate={{ width: `${share(props[s.key], total)}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-muted">
        {SEGMENTS.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={`size-2 rounded-full ${s.className}`} />
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
