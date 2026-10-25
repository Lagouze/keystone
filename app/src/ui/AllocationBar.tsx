import { motion } from 'motion/react'

interface AllocationBarProps {
  /** Quantities in display units; only their proportions matter. */
  available: number
  locked: number
  shortfall: number
}

const SEGMENTS = [
  { key: 'locked', label: 'Locked', className: 'bg-accent' },
  { key: 'available', label: 'Available', className: 'bg-accent-light' },
  { key: 'shortfall', label: 'Shortfall', className: 'bg-warning' },
] as const

export function AllocationBar(props: AllocationBarProps) {
  const total = props.available + props.locked + props.shortfall
  return (
    <div>
      <div
        className="flex h-2.5 overflow-hidden rounded-full bg-surface-muted"
        role="img"
        aria-label={SEGMENTS.map((s) => `${s.label} ${props[s.key]}`).join(', ')}
      >
        {SEGMENTS.map((s) => (
          <motion.div
            key={s.key}
            className={s.className}
            initial={false}
            animate={{ width: total > 0 ? `${(props[s.key] / total) * 100}%` : '0%' }}
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
