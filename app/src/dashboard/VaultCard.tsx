import type { AssetInfo, SessionState } from '@keystone/shared'
import { formatCountdown, formatUnits, shortAddress } from '../lib/format.ts'
import { AllocationBar, Card, Stat, StatusPill } from '../ui/index.ts'

interface VaultCardProps {
  session: SessionState
  asset: AssetInfo
  now: number
}

export function VaultCard({ session, asset, now }: VaultCardProps) {
  const { vault } = session
  const fmt = (units: string) => formatUnits(units, asset.decimals)
  const countdown = vault.callDeadline ? formatCountdown(vault.callDeadline, now) : null
  const shortfall = BigInt(vault.shortfallUnits) > 0n

  return (
    <Card
      title={`Collateral vault · ${asset.code}`}
      description="Tokens the fund has posted on Stellar. The vault locks what the margin requires; the rest stays withdrawable."
      actions={
        <StatusPill status={vault.status}>
          {vault.status === 'margin_call' ? (countdown ?? 'deadline passed') : undefined}
        </StatusPill>
      }
    >
      <dl className="mb-6 grid grid-cols-3 gap-4 sm:gap-6">
        <Stat label="Available" value={fmt(vault.availableUnits)} unit={asset.code} />
        <Stat label="Locked" value={fmt(vault.lockedUnits)} unit={asset.code} tone="accent" />
        <Stat
          label="Shortfall"
          value={fmt(vault.shortfallUnits)}
          unit={asset.code}
          tone={shortfall ? 'warning' : 'default'}
        />
      </dl>
      <AllocationBar
        available={vault.availableUnits}
        locked={vault.lockedUnits}
        shortfall={vault.shortfallUnits}
        label={`Locked ${fmt(vault.lockedUnits)}, available ${fmt(vault.availableUnits)}, shortfall ${fmt(vault.shortfallUnits)} ${asset.code}`}
      />
      <p className="mt-4 text-xs text-ink-subtle">
        Vault contract{' '}
        <span className="font-mono" title={session.vaultId}>
          {shortAddress(session.vaultId)}
        </span>{' '}
        · epoch {vault.epoch}
      </p>
    </Card>
  )
}
