import { cx } from './cx.ts'

type Tone = 'default' | 'accent' | 'warning' | 'danger'
type Size = 'lg' | 'md'

const TONES: Record<Tone, string> = {
  default: 'text-ink',
  accent: 'text-accent',
  warning: 'text-warning-ink',
  danger: 'text-danger-ink',
}

const SIZES: Record<Size, string> = {
  lg: 'text-2xl sm:text-3xl',
  md: 'text-xl sm:text-2xl',
}

interface StatProps {
  label: string
  /** Already formatted for display (units or EUR). */
  value: string
  unit?: string
  tone?: Tone
  size?: Size
  hint?: string
}

export function Stat({ label, value, unit, tone = 'default', size = 'lg', hint }: StatProps) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd
        className={cx(
          'mt-1 font-medium tracking-tight tabular-nums [overflow-wrap:anywhere]',
          SIZES[size],
          TONES[tone],
        )}
      >
        {value}
        {unit && (
          <span className="ml-1.5 inline-block text-sm font-normal text-ink-subtle">{unit}</span>
        )}
      </dd>
      {hint && <dd className="mt-1 text-xs text-ink-subtle">{hint}</dd>}
    </div>
  )
}
