import type { ReactNode } from 'react'
import type { VaultStatus } from '@keystone/shared'
import { cx } from './cx.ts'

const STYLES: Record<VaultStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-success-soft text-success-ink' },
  margin_call: { label: 'Margin call', className: 'bg-warning-soft text-warning-ink' },
  defaulted: { label: 'Defaulted', className: 'bg-danger-soft text-danger-ink' },
}

interface StatusPillProps {
  status: VaultStatus
  /** Extra text after the label, for example the countdown of a margin call. */
  children?: ReactNode
}

export function StatusPill({ status, children }: StatusPillProps) {
  const { label, className } = STYLES[status]
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium',
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {label}
      {children && <span className="tabular-nums">· {children}</span>}
    </span>
  )
}
