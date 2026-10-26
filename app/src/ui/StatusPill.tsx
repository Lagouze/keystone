import type { ReactNode } from 'react'
import type { VaultStatus } from '@keystone/shared'
import { cx } from './cx.ts'

const STYLES: Record<VaultStatus, { label: string; className: string }> = {
  active: { label: 'Active', className: 'text-success' },
  margin_call: { label: 'Margin call', className: 'text-warning-ink' },
  defaulted: { label: 'Defaulted', className: 'text-danger' },
}

interface StatusPillProps {
  status: VaultStatus
  /** Replaces the default label, for example while a split-flap animation plays. */
  label?: ReactNode
  /** Extra text after the label, for example the countdown of a margin call. */
  children?: ReactNode
}

/** Status as typography: a small dot and letter-spaced capitals, no pill, no background. */
export function StatusPill({ status, label, children }: StatusPillProps) {
  const style = STYLES[status]
  return (
    <span
      role="status"
      aria-label={`Vault status: ${style.label}`}
      className={cx(
        'inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-xs font-medium uppercase tracking-[0.14em]',
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
