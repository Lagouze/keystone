import type { AssetInfo, SessionState } from '@keystone/shared'
import { formatEur, formatUnits } from '../lib/format.ts'
import { Card, SimulatedTag, Stat } from '../ui/index.ts'

interface MarginCardProps {
  session: SessionState
  asset: AssetInfo
}

export function MarginCard({ session, asset }: MarginCardProps) {
  const { margin } = session
  const historical = session.vault.status === 'defaulted'
  // Below the MTA the keeper does not post the new requirement: the vault keeps the previous one.
  const notPosted = !historical && margin.requiredUnits !== session.vault.requiredUnits
  return (
    <Card
      title="Margin requirement"
      description="The fund's loss must be covered by collateral. Tokens count at their price minus a haircut."
    >
      <dl className="grid grid-cols-2 gap-6">
        <Stat
          label={historical ? 'Last computed value' : 'Required value'}
          value={formatEur(margin.requiredValueEur)}
          unit="EUR"
          size="md"
          hint={historical ? 'Historical, frozen after the default' : undefined}
        />
        <Stat
          label={historical ? 'Last computed requirement' : 'Required'}
          value={formatUnits(margin.requiredUnits, asset.decimals)}
          unit={asset.code}
          size="md"
          hint={`Threshold ${formatEur(margin.thresholdEur)} · MTA ${formatEur(margin.mtaEur)} EUR`}
        />
      </dl>
      {notPosted && (
        <p className="mt-4 text-sm text-warning-ink">
          Change below the minimum transfer amount: the vault still requires{' '}
          {formatUnits(session.vault.requiredUnits, asset.decimals)} {asset.code}.
        </p>
      )}
      <p className="mt-4 text-sm text-ink-muted">
        {asset.code} unit price {formatEur(margin.unitPriceEur)} EUR
        <SimulatedTag /> · haircut {margin.haircutPct}%
      </p>
    </Card>
  )
}
