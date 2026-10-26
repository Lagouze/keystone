import { motion } from 'motion/react'
import { useId } from 'react'
import { cx } from './cx.ts'

interface SegmentedControlProps<T extends string> {
  label: string
  options: ReadonlyArray<{ value: T; label: string }>
  value: T
  onChange: (value: T) => void
  className?: string
}

/** Glass track with a sliding thumb (shared-layout animation), as the iOS segmented control. */
export function SegmentedControl<T extends string>({ label, options, value, onChange, className }: SegmentedControlProps<T>) {
  const id = useId()
  return (
    <div role="group" aria-label={label} className={cx('glass-lite inline-flex rounded-full p-1', className)}>
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cx(
              'relative rounded-full px-4 py-1.5 text-sm transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-chain',
              selected ? 'font-medium text-ink' : 'text-ink-muted hover:text-ink',
            )}
          >
            {selected && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-full bg-white/70 shadow-[0_2px_10px_rgba(28,28,30,0.12)]"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
