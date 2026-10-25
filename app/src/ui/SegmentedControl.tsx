import { cx } from './cx.ts'

interface SegmentedControlProps<T extends string> {
  label: string
  options: ReadonlyArray<{ value: T; label: string }>
  value: T
  onChange: (value: T) => void
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-control bg-surface-muted p-1">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cx(
              'rounded-lg px-3 py-1.5 text-sm transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
              selected
                ? 'bg-surface font-medium text-ink shadow-sm ring-1 ring-line-strong'
                : 'text-ink-muted hover:text-ink',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
