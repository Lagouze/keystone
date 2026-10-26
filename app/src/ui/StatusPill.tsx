import type { ReactNode } from 'react'
import type { VaultStatus } from '@keystone/shared'
import { cx } from './cx.ts'

const STYLES: Record<VaultStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-success-soft text-success' },
  margin_call: { label: 'Margin call', className: 'bg-warning-soft text-warning-ink' },
  defaulted: { label: 'Defaulted', className: 'bg-danger-soft text-danger' },
}

interface StatusPillProps {
  status: VaultStatus
  /** Replaces the default label, for example while a split-flap animation plays. */
  label?: ReactNode
  /** Extra text after the label, for example the countdown of a margin call. */
  children?: ReactNode
}

export function StatusPill({ status, label, children }: StatusPillProps) {
  const style = STYLES[status]
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wider',
        'transition-colors duration-350 ease-state',
        style.className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {label ?? style.label}
      {children && <span className="tabular-nums">· {children}</span>}
    </span>
  )
}
