import type { ReactNode } from 'react'
import { cx } from './cx.ts'

type Tone = 'info' | 'warning' | 'danger'

const TONES: Record<Tone, string> = {
  info: 'border-chain-light bg-chain-soft text-chain',
  warning: 'border-warning bg-warning-soft text-warning-ink',
  danger: 'border-danger bg-danger-soft text-danger',
}

interface BannerProps {
  tone?: Tone
  /** Announce it to screen readers: only for messages that appear after an action. */
  live?: boolean
  children: ReactNode
}

export function Banner({ tone = 'info', live = false, children }: BannerProps) {
  return (
    <div
      role={live ? (tone === 'info' ? 'status' : 'alert') : undefined}
      className={cx('rounded-control border px-4 py-3 text-sm', TONES[tone])}
    >
      {children}
    </div>
  )
}
