import type { AssetInfo, SessionState } from '@keystone/shared'
import { formatUnits } from '../lib/format.ts'
import { AllocationBar, Card, CoverageRing, Stat } from '../ui/index.ts'
import { RollUnits } from '../ui/motion.tsx'

interface VaultCardProps {
  session: SessionState
  asset: AssetInfo
  /** Seconds the figures take to roll (choreography). */
  duration: number
}

/** The vault at a glance: coverage ring, three figures, the gauge, and both balances. */
export function VaultCard({ session, asset, duration }: VaultCardProps) {
  const { vault, balances } = session
  const fmt = (units: string) => formatUnits(units, asset.decimals)
  const roll = (units: string) => <RollUnits units={units} decimals={asset.decimals} duration={duration} />

  return (
    <Card title={`Vault · ${asset.code}`}>
      <div className="flex flex-wrap items-center gap-8">
        <CoverageRing locked={vault.lockedUnits} required={vault.requiredUnits} />
        <div className="flex min-w-64 flex-1 flex-col gap-5">
          <dl className="grid grid-cols-3 gap-4">
            <Stat label="Free" value={roll(vault.availableUnits)} />
            <Stat label="Locked" value={roll(vault.lockedUnits)} tone="chain" />
            <Stat
              label="Missing"
              value={roll(vault.shortfallUnits)}
              tone={BigInt(vault.shortfallUnits) > 0n ? 'warning' : 'default'}
            />
          </dl>
          <AllocationBar
            available={vault.availableUnits}
            locked={vault.lockedUnits}
            shortfall={vault.shortfallUnits}
            label={`Locked ${fmt(vault.lockedUnits)}, free ${fmt(vault.availableUnits)}, missing ${fmt(vault.shortfallUnits)} ${asset.code}`}
          />
        </div>
      </div>
      <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-2 border-t border-line pt-4 text-sm">
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
    </Card>
  )
}
