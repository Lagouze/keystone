import { useEffect, useState } from 'react'
import type { MarketMetric, MarketSnapshot } from '@keystone/shared'
import { getMarketSnapshot } from '../api/http.ts'
import { KEEPER_URL } from '../config.ts'
import { Button } from '../ui/Button.tsx'
import { Modal } from '../ui/Modal.tsx'

function Source({ metric }: { metric: MarketMetric }) {
  // Source links are restricted to HTTPS; values are plain React text, never HTML.
  const safe = /^https:\/\/(data\.ecb\.europa\.eu|www\.cboe\.com|finance\.yahoo\.com)\//.test(metric.source.url)
  return safe ? <a className="underline underline-offset-2" href={metric.source.url} target="_blank" rel="noreferrer">{metric.source.name}</a> : <span>{metric.source.name}</span>
}

/** Pure display: choosing an asset and starting a vault remain separate, explicit Landing actions. */
export function MarketAdvisor() {
  const [open, setOpen] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 10_000)
    let active = true
    setPending(true)
    setError(null)
    setSnapshot(null)
    void getMarketSnapshot(KEEPER_URL, controller.signal).then((data) => {
      if (active) setSnapshot(data)
    }).catch(() => {
      if (active) setError('Insufficient market data. The market provider is unavailable or its response is invalid. Try again later.')
    }).finally(() => { if (active) setPending(false); window.clearTimeout(timeout) })
    return () => { active = false; controller.abort(); window.clearTimeout(timeout) }
  }, [open, attempt])

  return <>
    <Button className="mt-5 w-full" onClick={() => setOpen(true)}>Compare market conditions</Button>
    <Modal open={open} title="Collateral Market Advisor" onClose={() => setOpen(false)}>
      <p className="text-sm text-ink-muted">Indicative class comparison. Real published market observations, separate from simulated token prices. No wallet needed.</p>
      {pending && <p className="mt-4 text-sm" role="status">Loading market observations…</p>}
      {error && <p role="alert" className="mt-4 text-sm text-danger">{error}</p>}
      {snapshot && <div className="mt-5 grid gap-5">
        <section className="rounded-card bg-surface-muted p-4" aria-label="Recommendation">
          <h3 className="font-medium">{snapshot.advice.outcome}</h3>
          <p className="mt-2 text-sm text-ink-muted">{snapshot.advice.explanation}</p>
          {snapshot.advice.scores && <p className="mt-2 text-sm">Indicative scores / 100: KMMF {snapshot.advice.scores.KMMF} · KBOND {snapshot.advice.scores.KBOND}</p>}
          <p className="mt-2 text-xs text-ink-subtle">Evaluated {snapshot.asOf}. Not investment advice.</p>
        </section>
        <section aria-label="Five market indicators" className="grid gap-3">
          {snapshot.metrics.map((metric) => <article key={metric.id} className="rounded-card border border-line-strong p-4 text-sm">
            <h3 className="font-medium">{metric.name}</h3>
            <p className="mt-1 text-lg">{metric.value === null ? 'Unavailable' : `${Number(metric.value).toLocaleString('en-GB', { maximumFractionDigits: 4 })} ${metric.unit}`}</p>
            <p className="mt-1 text-xs text-ink-subtle">{metric.delivery} · {metric.freshness} · {metric.frequency} · observation {metric.observedAt ?? 'unavailable'}</p>
            <p className="mt-1 text-xs text-ink-subtle">Retrieved {metric.retrievedAt ?? 'never'} · <Source metric={metric} /></p>
            <p className="mt-2 text-xs text-ink-muted">{metric.note}</p>
            {metric.calculation && <p className="mt-1 text-xs text-ink-subtle">{metric.calculation.method}; {metric.calculation.observations} observations, {metric.calculation.start} – {metric.calculation.end}.</p>}
          </article>)}
        </section>
        <section aria-label="Comparison method">
          <h3 className="font-medium">KMMF / KBOND comparison</h3>
          <p className="mt-2 text-sm text-ink-muted">KMMF: assumed short duration, with fund NAV and redemption risks. KBOND: assumed two-year sovereign exposure, with mark-to-market rate risk. Actual token-specific risks are unmeasured.</p>
          <p className="mt-2 text-xs text-ink-subtle">Weights: {Object.entries(snapshot.advice.weights).map(([k, w]) => `${k} ${w}`).join(' · ')}. Score gap below 8: no clear preference.</p>
          {snapshot.advice.criteria.map((c) => <div key={c.id} className="mt-3 text-sm">
            <h4 className="font-medium">{c.label} · weight {c.weight} · KMMF {c.KMMF} / KBOND {c.KBOND}</h4>
            <p className="mt-1 text-ink-muted">{c.explanation}</p>
          </div>)}
        </section>
        <details className="text-xs text-ink-muted">
          <summary className="cursor-pointer font-medium">Assumptions and limits</summary>
          <ul className="mt-2 list-disc space-y-2 pl-4">{snapshot.advice.limits.map((limit) => <li key={limit}>{limit}</li>)}</ul>
        </details>
      </div>}
      <div className="mt-5 flex flex-wrap gap-2">
        <Button busy={pending} disabled={pending} onClick={() => setAttempt((v) => v + 1)}>Refresh observations</Button>
        <Button variant="primary" onClick={() => setOpen(false)}>Back to manual selection</Button>
      </div>
      <p className="mt-3 text-xs text-ink-subtle">Closing this assistant leaves your selection unchanged. Starting a session requires the separate Start button.</p>
    </Modal>
  </>
}
