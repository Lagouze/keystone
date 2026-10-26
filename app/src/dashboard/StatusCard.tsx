import type { AssetInfo, KeystoneConfig, VaultStatus } from '@keystone/shared'
import { formatEur, formatUnits, formatUtcTime } from '../lib/format.ts'
import type { Stage } from '../state/useChoreography.ts'
import type { Action } from '../state/useKeystone.ts'
import { Button, Card, StatusPill } from '../ui/index.ts'
import { Countdown, FlapLabel, HoldToSettle } from '../ui/motion.tsx'
import { SigningProgress } from './SigningProgress.tsx'

interface StatusCardProps {
  stage: Stage
  asset: AssetInfo
  signerMode: KeystoneConfig['signerMode']
  busy: Action | null
  step: string | null
  now: number
  onDeposit(input: string): void
  onSettle(): void
}

const STATUS_WORD: Record<VaultStatus, string> = {
  active: 'ACTIVE',
  margin_call: 'MARGIN CALL',
  defaulted: 'DEFAULTED',
}

/**
 * Flighty-style status: what is happening, by how much, and until when. Driven by the
 * choreography stage: the pill flips first, the text and figures follow, then the card lights
 * up and the countdown starts.
 */
export function StatusCard(props: StatusCardProps) {
  const { stage, asset, busy, now } = props
  const session = stage.shown
  const { vault, margin } = session
  const fmt = (units: string) => formatUnits(units, asset.decimals)
  const code = asset.code
  const remainingMs = vault.callDeadline ? Date.parse(vault.callDeadline) - now : null
  const secondsLeft = remainingMs === null ? 0 : Math.max(0, Math.ceil(remainingMs / 1000))
  const deadlinePassed = vault.status === 'margin_call' && remainingMs !== null && remainingMs <= 0
  // While a sequence plays, the screen lags the confirmed state: no action on stale figures.
  const otherBusy = (action: Action) => stage.sequencing || (busy !== null && busy !== action)

  let headline: string
  let detail: string
  if (vault.status === 'margin_call') {
    headline = `${fmt(vault.shortfallUnits)} ${code} missing. Cover before ${
      vault.callDeadline ? formatUtcTime(vault.callDeadline) : '—'
    } UTC, or the ${fmt(vault.lockedUnits)} locked ${code} go to the bank.`
    detail = `Rates moved against the fund: the requirement posted on-chain is ${fmt(vault.requiredUnits)} ${code} (latest computation: ${formatEur(
      margin.requiredValueEur,
    )} EUR, ${margin.haircutPct}% haircut). The vault already locks all it holds.`
  } else if (vault.status === 'defaulted') {
    headline = `Defaulted. The locked collateral was transferred to the bank.`
    detail = `Exactly the locked amount, enforced by the Soroban vault. The bank now holds ${fmt(
      session.balances.bankUnits,
    )} ${code}; ${fmt(vault.availableUnits)} ${code} remain withdrawable by the fund.`
  } else if (BigInt(vault.requiredUnits) === 0n) {
    headline = 'No margin required yet.'
    detail = 'Deposit collateral, then move rates: the keeper reprices the swap and posts the requirement on-chain.'
  } else {
    headline = `Covered. ${fmt(vault.availableUnits)} ${code} free to withdraw.`
    detail = `The vault locks ${fmt(vault.lockedUnits)} ${code}, the requirement posted on-chain. No cash set aside: the fund pays the fixed rate and receives Euribor, so it owes the bank collateral when rates fall.`
  }

  const tone = stage.halo ? 'call' : stage.settled ? 'default-settled' : 'default'
  const callOpen = vault.status === 'margin_call'

  return (
    <Card tone={tone} starCapable star={stage.halo}>
      <div className="grid items-start gap-6 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex max-w-2xl flex-col items-start gap-3">
          <StatusPill status={stage.status} label={<FlapLabel text={STATUS_WORD[stage.status]} />} />
          <h2 className="text-2xl leading-snug tracking-tight sm:text-[1.75rem]">{headline}</h2>
          <p className="text-[0.9375rem] leading-relaxed text-ink-muted">{detail}</p>
        </div>
        {callOpen && stage.countdown && (
          <div className="flex flex-col items-end gap-1">
            <span className="label-caps">Grace period</span>
            <span className="text-5xl font-light leading-none text-warning-ink">
              <Countdown seconds={secondsLeft} />
            </span>
          </div>
        )}
      </div>

      {callOpen && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            busy={busy === 'deposit'}
            disabled={otherBusy('deposit')}
            onClick={() => props.onDeposit(formatUnits(vault.shortfallUnits, asset.decimals, asset.decimals).replace(/,/g, ''))}
          >
            {busy === 'deposit' ? 'Depositing…' : `Deposit ${formatUnits(vault.shortfallUnits, asset.decimals, asset.decimals)} ${code}`}
          </Button>
          {deadlinePassed ? (
            <HoldToSettle disabled={otherBusy('settle') || busy === 'settle'} onHold={props.onSettle} />
          ) : (
            <Button variant="danger" disabled>
              Settle default · after deadline
            </Button>
          )}
          <span className="text-sm text-ink-subtle">
            {props.signerMode === 'keeper' ? 'Signed by the keeper (public demo)' : 'Signed by the fund in Freighter'}
          </span>
        </div>
      )}
      <SigningProgress busy={busy} step={props.step} />
    </Card>
  )
}
