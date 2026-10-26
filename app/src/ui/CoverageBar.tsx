import { motion } from 'motion/react'
import { cx } from './cx.ts'

interface CoverageBarProps {
  /** Amounts in the token's smallest unit (`*Units` strings). */
  locked: string
  required: string
}

/**
 * Locked over required, as one slim bar: blue is what the vault holds, red the gap. The percentage
 * is typography, not a badge. Ratio computed in BigInt (0.1 % precision).
 */
export function CoverageBar({ locked, required }: CoverageBarProps) {
  const req = BigInt(required)
  const lock = BigInt(locked)
  const ratio = req === 0n ? 0 : Math.min(1, Number((lock * 1000n) / req) / 1000)
  const missing = req > 0n && lock < req
  const pct = req === 0n ? null : Math.floor(ratio * 100)
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <span className="label-caps">Coverage</span>
        <span
          className={cx('text-sm font-medium tabular-nums', missing ? 'text-warning-ink' : 'text-ink')}
          role="img"
          aria-label={pct === null ? 'No requirement posted' : `Requirement ${pct} percent covered`}
        >
          {pct === null ? 'No requirement' : `${pct}% covered`}
        </span>
      </div>
      <div className={cx('mt-3 h-1.5 overflow-hidden rounded-full transition-colors duration-350 ease-state', missing ? 'bg-warning/35' : 'bg-surface-muted')}>
        <motion.div
          className="gpu h-full origin-left rounded-full bg-chain"
          // Fills from empty when it appears, then follows every change.
          initial={{ scaleX: 0 }}
          animate={{ scaleX: ratio }}
          transition={{ type: 'spring', stiffness: 110, damping: 20 }}
        />
      </div>
    </div>
  )
}
