import { motion } from 'motion/react'
import type { AssetInfo, SessionState } from '@keystone/shared'
import { formatUnits, formatUtcTime } from '../lib/format.ts'
import { CHOREO } from '../state/useChoreography.ts'
import { Card } from '../ui/index.ts'
import { cx } from '../ui/cx.ts'

/** Wise-style breakdown of what happens if a margin call is not covered. */
interface SettlementCardProps {
  session: SessionState
  asset: AssetInfo
  /** Default settled just now: the locked collateral travels from the vault to the bank. */
  transfer: boolean
  /** Amount on the travelling token (the locked amount before settlement). */
  transferUnits: string | null
}

export function SettlementCard({ session, asset, transfer, transferUnits }: SettlementCardProps) {
  const { vault, balances } = session
  const fmt = (units: string) => formatUnits(units, asset.decimals)
  const settled = vault.status === 'defaulted'
  const steps = [
    {
      label: 'Deadline (ledger time)',
      value: vault.callDeadline
        ? formatUtcTime(vault.callDeadline)
        : settled
          ? 'passed'
          : vault.status === 'margin_call'
            ? '—'
            : 'grace period after a call',
    },
    { label: 'Anyone can settle', value: 'settle_default' },
    {
      // After a default, the bank's balance (it may include earlier sessions' defaults).
      label: settled ? 'Bank balance' : 'Would go to the bank',
      value: `${settled ? fmt(balances.bankUnits) : fmt(vault.lockedUnits)} ${asset.code}`,
      danger: true,
    },
  ]
  return (
    <Card title={settled ? 'Default settled' : 'If a margin call is not covered'}>
      <ol className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3.5 text-sm">
        {steps.map((step, i) => (
          <li key={step.label} role="listitem" className="contents">
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
      {(transfer || settled) && (
        <div className="relative mt-5 flex h-12 items-center justify-between text-sm" aria-hidden={!transfer}>
          <span className="rounded-control border border-line bg-surface-subtle px-3 py-1.5">Vault</span>
          <span className="absolute inset-x-20 top-1/2 border-t border-dashed border-line-strong" />
          <span className="rounded-control border border-line bg-surface-subtle px-3 py-1.5">Bank</span>
          {transfer && transferUnits && (
            <motion.span
              className="absolute top-2.5 whitespace-nowrap rounded-full bg-danger px-3 py-1 text-xs font-medium text-white"
              initial={{ left: '4rem', opacity: 0 }}
              animate={{ left: 'calc(100% - 9.5rem)', opacity: 1 }}
              transition={{ duration: CHOREO.transferMs / 1000, ease: [0.8, 0.05, 0.2, 0.95] }}
            >
              {formatUnits(transferUnits, asset.decimals)} {asset.code}
            </motion.span>
          )}
        </div>
      )}
      <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-ink-subtle">
        Exactly the locked amount, enforced by the Soroban vault. No party can move more.
      </p>
    </Card>
  )
}
