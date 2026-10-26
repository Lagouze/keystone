import type { AssetInfo, SessionState } from '@keystone/shared'
import { formatEur, formatUnits, shortAddress } from '../lib/format.ts'
import { AllocationBar, Card, CoverageRing, Stat, Tile } from '../ui/index.ts'

export function VaultCard({ session, asset }: { session: SessionState; asset: AssetInfo }) {
  const { vault, margin } = session
  const fmt = (units: string) => formatUnits(units, asset.decimals)
  const historical = vault.status === 'defaulted'
  // Below the MTA the keeper does not post the new requirement: the vault keeps the previous one.
  const notPosted = !historical && margin.requiredUnits !== vault.requiredUnits

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-8">
        <CoverageRing locked={vault.lockedUnits} required={vault.requiredUnits} />
        <div className="flex min-w-72 flex-1 flex-col gap-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-medium">Collateral vault · {asset.code}</h2>
            <span className="text-xs text-ink-subtle">
              Soroban contract <span title={session.vaultId}>{shortAddress(session.vaultId)}</span> · epoch {vault.epoch}
            </span>
          </div>
          <dl className="grid grid-cols-3 gap-4 sm:gap-6">
            <Stat label="Available" value={fmt(vault.availableUnits)} />
            <Stat label="Locked" value={fmt(vault.lockedUnits)} tone="chain" />
            <Stat
              label="Shortfall"
              value={fmt(vault.shortfallUnits)}
              tone={BigInt(vault.shortfallUnits) > 0n ? 'warning' : 'default'}
            />
          </dl>
          <AllocationBar
            available={vault.availableUnits}
            locked={vault.lockedUnits}
            shortfall={vault.shortfallUnits}
            label={`Locked ${fmt(vault.lockedUnits)}, available ${fmt(vault.availableUnits)}, shortfall ${fmt(vault.shortfallUnits)} ${asset.code}`}
          />
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <Tile
          label={historical ? 'Last computed requirement' : 'Margin requirement'}
          value={`${formatEur(margin.requiredValueEur)} EUR`}
          sim
        />
        <Tile label="Haircut" value={`${margin.haircutPct}%`} sim />
        <Tile label="Threshold" value={`${formatEur(margin.thresholdEur)} EUR`} />
        <Tile label="Min. transfer" value={`${formatEur(margin.mtaEur)} EUR`} />
      </dl>
      {notPosted && (
        <p className="mt-4 text-sm text-warning-ink">
          Computed requirement {fmt(margin.requiredUnits)} {asset.code} is below the minimum transfer amount: the
          vault still requires {fmt(vault.requiredUnits)} {asset.code}.
        </p>
      )}
      {historical && (
        <p className="mt-4 text-sm text-ink-subtle">
          Last computed requirement: {fmt(margin.requiredUnits)} {asset.code} (historical, frozen after the default).
        </p>
      )}
    </Card>
  )
}
