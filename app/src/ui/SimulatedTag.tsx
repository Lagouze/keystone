/** Marks a value as simulated (rates, prices, NAV), as required by the plan. Violet = simulated. */
export function SimulatedTag() {
  return <span className="ml-1 font-medium tracking-wider text-sim">· SIMULATED</span>
}
