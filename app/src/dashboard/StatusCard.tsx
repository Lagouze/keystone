import { motion } from 'motion/react'
import type { AssetInfo, KeystoneConfig, VaultStatus } from '@keystone/shared'
import { formatUnits, formatUtcTime } from '../lib/format.ts'
import { CHOREO, type Stage } from '../state/useChoreography.ts'
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
 * The one sentence that matters: what is happening, by how much, until when. A status pill only
 * appears when something is wrong (margin call, default).
 */
export function StatusCard(props: StatusCardProps) {
  const { stage, asset, busy, now } = props
  const session = stage.shown
  const { vault } = session
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
    headline = `${fmt(vault.shortfallUnits)} ${code} missing`
    detail = `Cover before ${vault.callDeadline ? formatUtcTime(vault.callDeadline) : '—'} UTC, or the ${fmt(
      vault.lockedUnits,
    )} locked ${code} go to the bank.`
  } else if (vault.status === 'defaulted') {
    headline = 'Collateral sent to the bank'
    detail = `The bank now holds ${fmt(session.balances.bankUnits)} ${code}. Enforced by the vault.`
  } else if (BigInt(vault.requiredUnits) === 0n) {
    headline = 'No margin required'
    detail = 'Deposit collateral, then move rates.'
  } else {
    headline = 'Fully covered'
    detail = `${fmt(vault.lockedUnits)} ${code} locked · ${fmt(vault.availableUnits)} ${code} free · no cash set aside.`
  }

  const tone = stage.halo ? 'call' : stage.settled ? 'default-settled' : 'default'
  const callOpen = vault.status === 'margin_call'

  return (
    <Card tone={tone} starCapable star={stage.halo}>
      <div className="grid items-start gap-6 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex flex-col items-start gap-2.5">
          {stage.status !== 'active' && (
            <StatusPill status={stage.status} label={<FlapLabel text={STATUS_WORD[stage.status]} />} />
          )}
          <h2 className="text-3xl font-medium tracking-tight sm:text-4xl">{headline}</h2>
          <p className="text-[0.9375rem] text-ink-muted">{detail}</p>
        </div>
        {callOpen && stage.countdown && (
          <motion.div
            className="flex flex-col items-end gap-1"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <span className="label-caps">Time left</span>
            <span className="text-5xl font-light leading-none text-warning-ink">
              <Countdown seconds={secondsLeft} />
            </span>
          </motion.div>
        )}
      </div>

      {stage.transfer && stage.transferUnits && (
        <div className="relative mt-6 flex h-11 items-center justify-between text-sm" aria-hidden="true">
          <span className="rounded-full bg-surface-muted px-3.5 py-1.5">Vault</span>
          <span className="absolute inset-x-24 top-1/2 border-t border-dashed border-line-strong" />
          <span className="rounded-full bg-surface-muted px-3.5 py-1.5">Bank</span>
          <motion.span
            className="absolute top-2 whitespace-nowrap rounded-full bg-danger px-3 py-1 text-xs font-medium text-white"
            initial={{ left: '4.5rem', opacity: 0 }}
            animate={{ left: 'calc(100% - 10rem)', opacity: 1 }}
            transition={{ duration: CHOREO.transferMs / 1000, ease: [0.8, 0.05, 0.2, 0.95] }}
          >
            {fmt(stage.transferUnits)} {code}
          </motion.span>
        </div>
      )}

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
            <Button variant="sim" disabled>
              Settle after deadline
            </Button>
          )}
        </div>
      )}
      <SigningProgress busy={busy} step={props.step} />
    </Card>
  )
}
