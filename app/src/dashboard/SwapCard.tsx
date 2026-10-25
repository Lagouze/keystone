import type { SessionState } from '@keystone/shared'
import { formatEur, formatPct } from '../lib/format.ts'
import { Card, SimulatedTag, Stat } from '../ui/index.ts'

const SOURCE_LABEL: Record<SessionState['swap']['floatRateSource'], string> = {
  ecb: 'ECB Euribor 3M',
  cache: 'ECB Euribor 3M (cached)',
  scenario: 'Scenario rate',
}

export function SwapCard({ swap, margin }: Pick<SessionState, 'swap' | 'margin'>) {
  const losing = Number(margin.mtmFundEur) < 0
  return (
    <Card
      title="Interest rate swap"
      description="The fund pays a fixed rate and receives Euribor 3M. When rates fall, the fund owes the bank."
    >
      <dl className="grid grid-cols-2 gap-6">
        <Stat label="Fixed rate" value={formatPct(swap.fixedRatePct)} size="md" />
        <Stat
          label="Floating rate"
          value={formatPct(swap.floatRatePct)}
          size="md"
          hint={SOURCE_LABEL[swap.floatRateSource]}
        />
        <Stat
          label="Fund mark-to-market"
          value={formatEur(margin.mtmFundEur)}
          unit="EUR"
          size="md"
          tone={losing ? 'danger' : 'default'}
        />
        <Stat label="Notional" value={formatEur(swap.notionalEur)} unit="EUR" size="md" hint={`${swap.tenorYears} years`} />
      </dl>
      <p className="mt-4 text-sm text-ink-muted">
        Swap and rates
        <SimulatedTag />
      </p>
    </Card>
  )
}
