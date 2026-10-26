import type { Action } from '../state/useKeystone.ts'
import { LedgerWait, Shiny, SigningSteps } from '../ui/motion.tsx'

/** Steps of useKeystone's deposit / withdraw flow, in order. */
function stepIndex(step: string | null): number {
  if (!step) return 0
  if (step.startsWith('Prepar')) return 0
  if (step.startsWith('Confirm') || step.startsWith('Signing')) return 1
  return 2
}

/**
 * Shown under the actions while a write is in flight: Prepare → Sign → Submit → Confirmed
 * (Stepper), the sheen while Freighter waits (ShinyText), the ledger wait with its stopwatch
 * (LatticeLoader).
 */
export function SigningProgress({ busy, step }: { busy: Action | null; step: string | null }) {
  if (busy === 'deposit' || busy === 'withdraw') {
    const index = stepIndex(step)
    return (
      <div className="mt-5 grid gap-3 pt-4">
        <SigningSteps current={index} />
        <div className="text-sm" role={index === 2 ? undefined : 'status'}>
          {index === 1 ? <Shiny>{step ?? 'Confirm in Freighter…'}</Shiny> : index === 2 ? <LedgerWait /> : step}
        </div>
      </div>
    )
  }
  if (busy === 'settle' || busy === 'shock' || busy === 'start') {
    // A short wait: from sm up it sits in the panel's corner instead of pushing the panel taller
    // for a second, so a rate shock does not make the page bounce.
    return (
      <div className="mt-5 pt-4 text-sm sm:absolute sm:right-8 sm:bottom-7 sm:mt-0 sm:pt-0">
        <LedgerWait label={busy === 'start' ? 'Deploying the vault' : 'Waiting for the ledger'} />
      </div>
    )
  }
  return null
}
