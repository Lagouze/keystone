import type { AssetInfo, SessionState } from '@keystone/shared'
import { formatUnits, formatUtcTime } from '../lib/format.ts'
import { Card } from '../ui/index.ts'
import { cx } from '../ui/cx.ts'

/** Wise-style breakdown of what happens if a margin call is not covered. */
export function SettlementCard({ session, asset }: { session: SessionState; asset: AssetInfo }) {
  const { vault, balances } = session
  const fmt = (units: string) => formatUnits(units, asset.decimals)
  const settled = vault.status === 'defaulted'
  const steps = [
    {
      label: 'Deadline (ledger time)',
      value: vault.callDeadline ? formatUtcTime(vault.callDeadline) : vault.status === 'margin_call' ? '—' : 'grace period after a call',
    },
    { label: 'Anyone can settle', value: 'settle_default' },
    {
      label: settled ? 'Transferred to the bank' : 'Would go to the bank',
      value: `${settled ? fmt(balances.bankUnits) : fmt(vault.lockedUnits)} ${asset.code}`,
      danger: true,
    },
  ]
  return (
    <Card title={settled ? 'Default settled' : 'If a margin call is not covered'}>
      <ol className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3.5 text-sm">
        {steps.map((step, i) => (
          <li key={step.label} className="contents">
            <span
              className={cx(
                'flex size-7 items-center justify-center rounded-full text-xs font-medium',
                step.danger ? 'bg-danger-soft text-danger' : 'bg-surface-muted text-ink-muted',
              )}
            >
              {i + 1}
            </span>
            <span className="text-ink-muted">{step.label}</span>
            <span className={cx('font-medium tabular-nums', step.danger && 'text-danger')}>{step.value}</span>
          </li>
        ))}
      </ol>
      <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-ink-subtle">
        Exactly the locked amount, enforced by the Soroban vault. No party can move more.
      </p>
    </Card>
  )
}
