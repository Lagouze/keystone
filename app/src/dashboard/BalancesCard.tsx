import type { AssetInfo, SessionState } from '@keystone/shared'
import { unitsToFloat } from '../lib/format.ts'
import { Card, Stat } from '../ui/index.ts'
import { Figure, unitDecimals } from '../ui/motion.tsx'

export function BalancesCard({ session, asset, duration }: { session: SessionState; asset: AssetInfo; duration: number }) {
  const roll = (units: string) => {
    const value = unitsToFloat(units, asset.decimals)
    return <Figure value={value} decimals={unitDecimals(value)} duration={duration} />
  }
  return (
    <Card title="Balances" description="Tokens held outside the vault. In a default, the locked collateral lands with the bank.">
      <dl className="grid grid-cols-2 gap-6">
        <Stat label="Fund" value={roll(session.balances.fundUnits)} unit={asset.code} size="md" />
        <Stat
          label="Bank"
          value={roll(session.balances.bankUnits)}
          unit={asset.code}
          size="md"
          tone={BigInt(session.balances.bankUnits) > 0n ? 'danger' : 'default'}
        />
      </dl>
    </Card>
  )
}
