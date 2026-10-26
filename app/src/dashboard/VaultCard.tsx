import type { AssetInfo, SessionState } from '@keystone/shared'
import { formatUnits } from '../lib/format.ts'
import { Card, CoverageBar, Stat } from '../ui/index.ts'
import { RollUnits } from '../ui/motion.tsx'

interface VaultCardProps {
  session: SessionState
  asset: AssetInfo
  /** Seconds the figures take to roll (choreography). */
  duration: number
}

/** The vault at a glance: three figures, coverage, the allocation, and both balances. */
export function VaultCard({ session, asset, duration }: VaultCardProps) {
  const { vault, balances } = session
  const fmt = (units: string) => formatUnits(units, asset.decimals)
  const roll = (units: string) => <RollUnits units={units} decimals={asset.decimals} duration={duration} />
  // Below the MTA the keeper does not post the new requirement: the vault keeps the previous one.
  const notPosted = vault.status !== 'defaulted' && session.margin.requiredUnits !== vault.requiredUnits

  return (
    <Card title={`Vault · ${asset.code}`} className="min-h-72">
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
        <div className="flex items-baseline gap-2">
          <dt className="text-ink-subtle">Bank</dt>
          <dd className={BigInt(balances.bankUnits) > 0n ? 'font-medium text-danger' : 'font-medium'}>
            <RollUnits units={balances.bankUnits} decimals={asset.decimals} duration={duration} /> {asset.code}
          </dd>
        </div>
      </dl>
      {notPosted && (
        <p className="mt-3 text-xs text-ink-subtle">
          New requirement {fmt(session.margin.requiredUnits)} {asset.code} is under the minimum transfer: not posted.
        </p>
      )}
    </Card>
  )
}
