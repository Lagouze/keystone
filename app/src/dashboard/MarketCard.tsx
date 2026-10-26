import type { AssetInfo, SessionState } from '@keystone/shared'
import { valueAfterHaircut } from '../lib/format.ts'
import { Card } from '../ui/index.ts'
import { cx } from '../ui/cx.ts'
import { Figure, KeyFigure } from '../ui/motion.tsx'

/** The three market figures, all simulated: the fund's loss, the rate, the cash kept invested. */
export function MarketCard({ session, asset, opening }: { session: SessionState; asset: AssetInfo; opening: boolean }) {
  const { swap, margin, vault } = session
  const mtm = Number(margin.mtmFundEur)
  const gapBp = Math.round((Number(swap.floatRatePct) - Number(swap.fixedRatePct)) * 100)
  const cashKept = Number(valueAfterHaircut(vault.lockedUnits, asset.decimals, margin.unitPriceEur, margin.haircutPct))

  return (
    <Card title="Market" description="Simulated" className="min-h-56">
      <dl className="grid gap-5">
        <div>
          <dt className="label-caps">Fund P&amp;L</dt>
          <dd className={cx('mt-1 text-2xl font-light', mtm < 0 ? 'text-danger' : mtm > 0 ? 'text-success' : '')}>
            {mtm < 0 && '−'}
            <Figure value={Math.abs(mtm)} decimals={2} /> €
          </dd>
        </div>
        <div>
          <dt className="label-caps">Euribor 3M</dt>
          <dd className="mt-1 text-2xl font-light">
            <Figure value={Number(swap.floatRatePct)} decimals={3} />%
            {gapBp !== 0 && (
              <span className="ml-2 text-sm text-ink-subtle">
                {gapBp > 0 ? '+' : '−'}
                {Math.abs(gapBp)} bp vs fixed
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="label-caps">Cash kept invested</dt>
          <dd className="mt-1 text-2xl font-light">
            <KeyFigure value={cashKept} intro={opening} /> €
          </dd>
        </div>
      </dl>
    </Card>
  )
}
