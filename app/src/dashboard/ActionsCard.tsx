import { useState, type FormEvent } from 'react'
import type { AssetInfo, KeystoneConfig, SessionState } from '@keystone/shared'
import { formatCountdown } from '../lib/format.ts'
import type { Action } from '../state/useKeystone.ts'
import { Button, Card } from '../ui/index.ts'

const SHOCKS = [-50, -30, +60, -100] as const

interface ActionsCardProps {
  session: SessionState
  asset: AssetInfo
  signerMode: KeystoneConfig['signerMode']
  mocks: boolean
  busy: Action | null
  step: string | null
  now: number
  onDeposit(input: string): void
  onWithdraw(input: string): void
  onShock(bp: number): void
  onSettle(): void
}

const inputClass =
  'h-10 w-28 rounded-control border border-line-strong bg-surface px-3 text-sm tabular-nums ' +
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent'

export function ActionsCard(props: ActionsCardProps) {
  const { session, asset, busy, now } = props
  const { vault } = session
  const [depositInput, setDepositInput] = useState('300')
  const [withdrawInput, setWithdrawInput] = useState('')
  const [lastShock, setLastShock] = useState<number | null>(null)

  const defaulted = vault.status === 'defaulted'
  const hasAvailable = BigInt(vault.availableUnits) > 0n
  const deadlinePassed =
    vault.status === 'margin_call' && vault.callDeadline !== null && formatCountdown(vault.callDeadline, now) === null
  const otherBusy = (action: Action) => busy !== null && busy !== action

  const signing =
    props.signerMode === 'keeper'
      ? 'Signed by the keeper with the demo fund key (public demo mode).'
      : props.mocks
        ? 'Freighter signature simulated (mocks).'
        : 'Signed by the fund in Freighter.'

  const submit = (handler: (input: string) => void, input: string) => (event: FormEvent) => {
    event.preventDefault()
    handler(input)
  }

  return (
    <Card
      title="Scenario"
      description="Move rates to change the fund's exposure, then watch the vault lock, call, release or settle collateral."
    >
      <div className="grid gap-5">
        <section aria-label="Rate shocks">
          <h3 className="mb-2 text-sm text-ink-muted">Rate shock (Euribor 3M, simulated)</h3>
          <div className="flex flex-wrap gap-2">
            {SHOCKS.map((bp) => (
              <Button
                key={bp}
                variant="secondary"
                busy={busy === 'shock' && lastShock === bp}
                disabled={defaulted || (busy !== null && !(busy === 'shock' && lastShock === bp))}
                onClick={() => {
                  setLastShock(bp)
                  props.onShock(bp)
                }}
              >
                {bp > 0 ? '+' : '−'}
                {Math.abs(bp)} bp
              </Button>
            ))}
          </div>
        </section>

        <div className="grid gap-5 sm:grid-cols-2">
          <form onSubmit={submit(props.onDeposit, depositInput)} aria-label="Deposit">
            <label htmlFor="deposit" className="mb-2 block text-sm text-ink-muted">
              Deposit {asset.code}
            </label>
            <div className="flex gap-2">
              <input
                id="deposit"
                className={inputClass}
                inputMode="decimal"
                value={depositInput}
                onChange={(e) => setDepositInput(e.target.value)}
                disabled={defaulted}
              />
              <Button type="submit" variant="primary" busy={busy === 'deposit'} disabled={defaulted || otherBusy('deposit')}>
                {busy === 'deposit' ? (props.step ?? 'Depositing…') : 'Deposit'}
              </Button>
            </div>
          </form>

          <form onSubmit={submit(props.onWithdraw, withdrawInput)} aria-label="Withdraw">
            <label htmlFor="withdraw" className="mb-2 block text-sm text-ink-muted">
              Withdraw {asset.code}
            </label>
            <div className="flex gap-2">
              <input
                id="withdraw"
                className={inputClass}
                inputMode="decimal"
                placeholder="0"
                value={withdrawInput}
                onChange={(e) => setWithdrawInput(e.target.value)}
                disabled={!hasAvailable}
              />
              <Button type="submit" busy={busy === 'withdraw'} disabled={!hasAvailable || otherBusy('withdraw')}>
                {busy === 'withdraw' ? (props.step ?? 'Withdrawing…') : 'Withdraw'}
              </Button>
            </div>
          </form>
        </div>
        <p className="-mt-2 text-xs text-ink-subtle">{signing}</p>

        <section aria-label="Default settlement" className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
          <Button
            variant="danger"
            busy={busy === 'settle'}
            disabled={!deadlinePassed || otherBusy('settle')}
            onClick={props.onSettle}
          >
            Settle default
          </Button>
          <p className="text-xs text-ink-subtle">
            {defaulted
              ? 'Settled: the locked collateral went to the bank.'
              : vault.status === 'margin_call'
                ? deadlinePassed
                  ? 'The grace period is over: anyone can settle on-chain.'
                  : 'Available once the grace period of the margin call ends.'
                : 'Only possible after an unmet margin call.'}
          </p>
        </section>
      </div>
    </Card>
  )
}
