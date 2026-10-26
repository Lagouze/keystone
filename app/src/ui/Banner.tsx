import type { ReactNode } from 'react'
import { cx } from './cx.ts'

type Tone = 'info' | 'warning' | 'danger'

const TONES: Record<Tone, string> = {
  info: 'glass text-ink-muted',
  warning: 'glass text-warning-ink',
  danger: 'glass text-danger',
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
      className={cx('rounded-3xl px-5 py-3 text-sm shadow-card', TONES[tone])}
    >
      {children}
    </div>
  )
}
