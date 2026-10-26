import type { ReactNode } from 'react'
import { cx } from './cx.ts'

type Tone = 'default' | 'chain' | 'warning' | 'danger' | 'success'
type Size = 'xl' | 'lg' | 'md'

const TONES: Record<Tone, string> = {
  default: 'text-ink',
  chain: 'text-chain',
  warning: 'text-warning-ink',
  danger: 'text-danger',
  success: 'text-success',
}

const SIZES: Record<Size, string> = {
  xl: 'text-3xl font-light tracking-tight sm:text-4xl',
  lg: 'text-2xl font-light tracking-tight sm:text-3xl',
  md: 'text-lg sm:text-xl',
}

interface StatProps {
  label: string
  /** Already formatted for display (units or EUR), or a rolling figure. */
  value: ReactNode
  unit?: string
  tone?: Tone
  size?: Size
  hint?: string
}

export function Stat({ label, value, unit, tone = 'default', size = 'lg', hint }: StatProps) {
  return (
    <div className="min-w-0">
      <dt className="label-caps">{label}</dt>
      <dd className={cx('mt-1 tabular-nums wrap-anywhere', SIZES[size], TONES[tone])}>
        {value}
        {unit && (
          <span className="ml-1.5 inline-block text-sm font-normal tracking-normal text-ink-subtle">{unit}</span>
        )}
      </dd>
      {hint && <dd className="mt-1 text-xs text-ink-subtle">{hint}</dd>}
    </div>
  )
}
