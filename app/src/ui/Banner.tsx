import type { ReactNode } from 'react'
import { cx } from './cx.ts'

type Tone = 'info' | 'warning' | 'danger'

const TONES: Record<Tone, string> = {
  info: 'border-accent-light bg-accent-soft text-accent',
  warning: 'border-warning bg-warning-soft text-warning-ink',
  danger: 'border-danger bg-danger-soft text-danger-ink',
}

export function Banner({ tone = 'info', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div
      role={tone === 'info' ? 'status' : 'alert'}
      className={cx('rounded-control border px-4 py-3 text-sm', TONES[tone])}
    >
      {children}
    </div>
  )
}
