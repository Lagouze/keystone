import { memo } from 'react'
import type { AssetInfo, SessionState } from '@keystone/shared'
import { formatUnits, valueAfterHaircut } from '../lib/format.ts'
import { AutoHeight } from '../ui/AutoHeight.tsx'
import { Card, CoverageBar, Stat } from '../ui/index.ts'
import { Figure, RollUnits } from '../ui/motion.tsx'

interface VaultCardProps {
  session: SessionState
  asset: AssetInfo
  /** Seconds the figures take to roll (choreography). */
  duration: number
}

/** The vault at a glance: three figures, coverage, the allocation, and both balances. */
export const VaultCard = memo(function VaultCard({ session, asset, duration }: VaultCardProps) {
  const { vault, balances } = session
  const fmt = (units: string) => formatUnits(units, asset.decimals)
  const roll = (units: string) => <RollUnits units={units} decimals={asset.decimals} duration={duration} />
  // Below the MTA the keeper does not post the new requirement: the vault keeps the previous one.
  // A larger gap is a posting on its way to the ledger (or one that failed, which the error banner
  // reports), not a requirement left unposted on purpose.
  const { margin } = session
  // The fund's gain on the swap is what the bank owes it (cash, simulated).
  const owedEur = Math.max(0, Number(margin.mtmFundEur))
  const gap = BigInt(margin.requiredUnits) - BigInt(vault.requiredUnits)
  const gapEur = Number(valueAfterHaircut((gap < 0n ? -gap : gap).toString(), asset.decimals, margin.unitPriceEur, margin.haircutPct))
  const notPosted = vault.status !== 'defaulted' && gap !== 0n && gapEur < Number(margin.mtaEur)

  return (
    <Card title={`Vault · ${asset.code}`} className="min-h-72">
      <AutoHeight>
        <div className="grid gap-8">
          <dl className="grid grid-cols-3 gap-6">
            <Stat label="Free" value={roll(vault.availableUnits)} />
            <Stat label="Locked" value={roll(vault.lockedUnits)} tone="chain" />
            <Stat
              label="Missing"
              value={roll(vault.shortfallUnits)}
              tone={BigInt(vault.shortfallUnits) > 0n ? 'warning' : 'default'}
            />
          </dl>
          <CoverageBar locked={vault.lockedUnits} required={vault.requiredUnits} />
        </div>
        <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-2 text-sm">
          <div className="flex items-baseline gap-2">
            <dt className="text-ink-subtle">Fund</dt>
            <dd className="font-medium">
              <RollUnits units={balances.fundUnits} decimals={asset.decimals} duration={duration} /> {asset.code}
            </dd>
          </div>
          {BigInt(balances.bankUnits) > 0n ? (
            // After a default: the tokens the vault sent to the bank, the on-chain settlement.
            <div className="flex items-baseline gap-2">
              <dt className="text-ink-subtle">Bank received</dt>
              <dd className="font-medium text-danger">
                <RollUnits units={balances.bankUnits} decimals={asset.decimals} duration={duration} /> {asset.code}
              </dd>
            </div>
          ) : (
            // Otherwise the other direction: when the swap moves in the fund's favour, the bank owes
            // the fund its gain in cash. Simulated: the vault only holds the fund's collateral.
            <div className="flex items-baseline gap-2" title="Simulated: the bank's side is not collateralized on-chain">
              <dt className="text-ink-subtle">Bank owes the fund</dt>
              <dd className={owedEur > 0 ? 'font-medium text-success' : 'font-medium'}>
                <Figure value={owedEur} decimals={2} /> € <span className="text-xs font-normal text-ink-subtle">simulated</span>
              </dd>
            </div>
          )}
        </dl>
        {notPosted && (
          <p className="mt-3 text-xs text-ink-subtle">
            New requirement {fmt(margin.requiredUnits)} {asset.code} is under the minimum transfer: not posted.
          </p>
        )}
      </AutoHeight>
    </Card>
  )
})
