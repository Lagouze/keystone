/** Marks a value as simulated (rates, prices, NAV), as required by the plan. */
export function SimulatedTag() {
  return (
    <span className="ml-1.5 rounded border border-line-strong px-1 py-px align-middle text-[0.625rem] font-medium uppercase tracking-wide text-ink-subtle">
      Simulated
    </span>
  )
}
