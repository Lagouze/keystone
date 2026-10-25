import { motion } from 'motion/react'
import { cx } from './cx.ts'

interface CoverageRingProps {
  /** Amounts in the token's smallest unit (`*Units` strings). */
  locked: string
  required: string
  size?: number
}

const STROKE = 10

/**
 * Locked over required, as Aave's utilisation rings: the blue arc is what the vault holds; when
 * collateral is missing the track turns amber, so the gap reads as the shortfall.
 * Ratio computed in BigInt (0.1 % precision).
 */
export function CoverageRing({ locked, required, size = 168 }: CoverageRingProps) {
  const req = BigInt(required)
  const lock = BigInt(locked)
  const ratio = req === 0n ? 0 : Math.min(1, Number((lock * 1000n) / req) / 1000)
  const missing = req > 0n && lock < req
  const pct = req === 0n ? null : Math.floor(ratio * 100)
  const center = size / 2
  const r = center - STROKE
  const c = 2 * Math.PI * r

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          strokeWidth={STROKE}
          className={cx('transition-[stroke] duration-350 ease-state', missing ? 'stroke-warning' : 'stroke-surface-muted')}
        />
        <motion.circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap={ratio > 0 && ratio < 1 ? 'round' : 'butt'}
          className="stroke-chain"
          strokeDasharray={c}
          transform={`rotate(-90 ${center} ${center})`}
          initial={false}
          animate={{ strokeDashoffset: c * (1 - ratio) }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </svg>
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        role="img"
        aria-label={pct === null ? 'No requirement posted' : `Requirement ${pct} percent covered`}
      >
        <span className="text-4xl font-light tracking-tight">{pct === null ? '—' : `${pct}%`}</span>
        <span className="label-caps mt-0.5">Covered</span>
      </div>
    </div>
  )
}
