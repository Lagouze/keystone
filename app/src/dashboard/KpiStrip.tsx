import type { AssetInfo, SessionState } from '@keystone/shared'
import { formatEur, formatUnits, formatUtcTime, valueAfterHaircut } from '../lib/format.ts'
import { SimulatedTag } from '../ui/index.ts'
import { cx } from '../ui/cx.ts'

/** Superstate-style band of key figures, divided by hairlines, with its "as of" stamp. */
export function KpiStrip({ session, asset }: { session: SessionState; asset: AssetInfo }) {
  const { swap, margin, vault } = session
  const mtm = Number(margin.mtmFundEur)
  // Gap between the floating and the fixed leg, in bp (shown as a gap, not as the cumulated shock).
  const gapBp = Math.round((Number(swap.floatRatePct) - Number(swap.fixedRatePct)) * 100)
  const SOURCE = { ecb: 'ECB', cache: 'ECB, cached', scenario: 'scenario' } as const
  const items = [
    {
      label: 'Fund mark-to-market',
      sim: true,
      value: `${formatEur(margin.mtmFundEur)} EUR`,
      tone: mtm < 0 ? 'text-danger' : mtm > 0 ? 'text-success' : '',
    },
    {
      label: 'Euribor 3M',
      sim: true,
      value: `${swap.floatRatePct}%`,
      hint: `vs fixed ${swap.fixedRatePct}% · ${gapBp > 0 ? '+' : gapBp < 0 ? '−' : '±'}${Math.abs(gapBp)} bp · source: ${SOURCE[swap.floatRateSource]}`,
    },
    { label: `${asset.code} NAV`, sim: true, value: `${formatEur(margin.unitPriceEur)} EUR` },
    { label: 'Required on-chain', value: `${formatUnits(vault.requiredUnits, asset.decimals)} ${asset.code}` },
    {
      label: 'Cash kept invested',
      sim: true,
      value: `${formatEur(valueAfterHaircut(vault.lockedUnits, asset.decimals, margin.unitPriceEur, margin.haircutPct))} EUR`,
    },
  ]

  return (
    <div className="border-b border-line bg-surface">
      <dl className="mx-auto grid max-w-7xl grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {items.map((item) => (
          <div key={item.label} className="border-line px-4 py-4 sm:px-6 lg:border-r lg:last:border-r-0">
            <dt className="label-caps">
              {item.label}
              {item.sim && <SimulatedTag />}
            </dt>
            <dd className={cx('mt-1.5 text-lg tabular-nums sm:text-xl', item.tone)}>
              {item.value}
            </dd>
            {item.hint && <dd className="mt-0.5 text-xs text-ink-subtle">{item.hint}</dd>}
          </div>
        ))}
      </dl>
      <p className="label-caps mx-auto max-w-7xl px-4 pb-2 text-right sm:px-6">
        As of {formatUtcTime(session.updatedAt)} UTC · epoch {vault.epoch}
      </p>
    </div>
  )
}
