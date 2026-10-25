import type { AssetInfo, SessionState } from '@keystone/shared'
import { formatUnits } from '../lib/format.ts'
import { Card, Stat } from '../ui/index.ts'

export function BalancesCard({ session, asset }: { session: SessionState; asset: AssetInfo }) {
  return (
    <Card title="Balances" description="Tokens held outside the vault. In a default, the locked collateral lands with the bank.">
      <dl className="grid grid-cols-2 gap-6">
        <Stat label="Fund" value={formatUnits(session.balances.fundUnits, asset.decimals)} unit={asset.code} size="md" />
        <Stat
          label="Bank"
          value={formatUnits(session.balances.bankUnits, asset.decimals)}
          unit={asset.code}
          size="md"
          tone={BigInt(session.balances.bankUnits) > 0n ? 'danger' : 'default'}
        />
      </dl>
    </Card>
  )
}
