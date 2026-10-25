import type { ReactNode } from 'react'

/** A contract or CSA parameter shown as a tile, like Aave's LTV / threshold / penalty tiles. */
export function Tile({ label, value, sim = false }: { label: string; value: ReactNode; sim?: boolean }) {
  return (
    <div className="rounded-control border border-line bg-surface-subtle px-3.5 py-3">
      <dt className="text-xs text-ink-subtle">
        {label}
        {sim && <span className="ml-1 text-sim">· sim</span>}
      </dt>
      <dd className="mt-0.5 text-sm font-medium tabular-nums">{value}</dd>
    </div>
  )
}
