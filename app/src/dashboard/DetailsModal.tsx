import type { AssetInfo, SessionState } from '@keystone/shared'
import { formatEur, formatUnits, formatUtcTime, shortAddress } from '../lib/format.ts'
import { Modal } from '../ui/Modal.tsx'

/** Everything dense but necessary, kept out of the main screen. */
export function DetailsModal({
  open,
  onClose,
  session,
  asset,
}: {
  open: boolean
  onClose(): void
  session: SessionState
  asset: AssetInfo
}) {
  const { swap, margin, vault } = session
  const historical = vault.status === 'defaulted' ? ' (historical)' : ''
  const SOURCE = { ecb: 'ECB', cache: 'ECB (cached)', scenario: 'scenario' } as const
  const rows: Array<[string, string]> = [
    ['Swap', `€${formatEur(swap.notionalEur).replace(/\.00$/, '')} · ${swap.tenorYears} years`],
    ['Fund pays', `${swap.fixedRatePct}% fixed`],
    ['Fund receives', `Euribor 3M · ${swap.floatRatePct}% (${SOURCE[swap.floatRateSource]}, simulated)`],
    ['Required value', `€${formatEur(margin.requiredValueEur)} (simulated)${historical}`],
    [`${asset.code} price`, `€${formatEur(margin.unitPriceEur)} (simulated)`],
    ['Haircut', `${margin.haircutPct}%`],
    ['Threshold', `€${formatEur(margin.thresholdEur)}`],
    ['Min. transfer', `€${formatEur(margin.mtaEur)}`],
    ['Required on-chain', `${formatUnits(vault.requiredUnits, asset.decimals)} ${asset.code}`],
    ['Last computed', `${formatUnits(margin.requiredUnits, asset.decimals)} ${asset.code}${historical}`],
    ['Vault contract', shortAddress(session.vaultId)],
    ['Epoch', String(vault.epoch)],
    ['As of', `${formatUtcTime(session.updatedAt)} UTC`],
  ]

  return (
    <Modal open={open} title="Details" onClose={onClose}>
      <dl className="grid gap-3 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-6 py-2.5">
            <dt className="text-ink-subtle">{label}</dt>
            <dd className="text-right font-medium" title={label === 'Vault contract' ? session.vaultId : undefined}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <h3 className="mt-6 text-sm font-medium">If a margin call is not covered</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
        When the grace period ends (ledger time), anyone can call settle_default: the vault sends exactly the locked
        collateral to the bank. No one can move more.
      </p>
    </Modal>
  )
}
