import { useEffect, useRef, useState, memo } from 'react'
import type { AssetInfo, SessionState } from '@keystone/shared'
import { valueAfterHaircut } from '../lib/format.ts'
import { Card } from '../ui/index.ts'
import { Sparkline } from '../ui/Sparkline.tsx'
import { cx } from '../ui/cx.ts'
import { Figure, KeyFigure } from '../ui/motion.tsx'

/** The three market figures, all simulated: the fund's loss, the rate, the cash kept invested. */
export const MarketCard = memo(function MarketCard({ session, asset, opening }: { session: SessionState; asset: AssetInfo; opening: boolean }) {
  const { swap, margin, vault } = session
  const mtm = Number(margin.mtmFundEur)
  const gapBp = Math.round((Number(swap.floatRatePct) - Number(swap.fixedRatePct)) * 100)
  const cashKept = Number(valueAfterHaircut(vault.lockedUnits, asset.decimals, margin.unitPriceEur, margin.haircutPct))

  // The fund's P&L over this session, one point per state received (kept in memory only).
  const [trend, setTrend] = useState<number[]>([])
  const trendOf = useRef(session.sessionId)
  useEffect(() => {
    setTrend((old) => {
      const base = trendOf.current === session.sessionId ? old : []
      trendOf.current = session.sessionId
      return base.at(-1) === mtm ? base : [...base, mtm].slice(-24)
    })
  }, [session.sessionId, session.updatedAt, mtm])

  return (
    <Card title="Market" description="Simulated" className="min-h-56">
      <dl className="grid gap-5">
        <div>
          <dt className="label-caps">Fund P&amp;L</dt>
          <dd className={cx('mt-1 text-2xl font-light', mtm < 0 ? 'text-danger' : mtm > 0 ? 'text-success' : '')}>
            {mtm < 0 && '−'}
            <Figure value={Math.abs(mtm)} decimals={2} /> €
          </dd>
          <div className={mtm < 0 ? 'mt-3 text-danger' : 'mt-3 text-success'}>
            <Sparkline values={trend} />
          </div>
          <p className="mt-1 text-xs text-ink-subtle">Since the session started</p>
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
})
