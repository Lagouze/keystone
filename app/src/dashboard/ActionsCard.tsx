import { useState, type FormEvent } from 'react'
import type { AssetInfo, KeystoneConfig, SessionState } from '@keystone/shared'
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
  /** A choreography sequence is playing (figures lag the confirmed state). */
  sequencing: boolean
  onDeposit(input: string): void
  onWithdraw(input: string): void
  onShock(bp: number): void
}

const inputClass =
  'h-11 w-28 rounded-full bg-surface-muted px-4 text-sm tabular-nums ' +
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-chain disabled:bg-surface-subtle'

export function ActionsCard(props: ActionsCardProps) {
  const { session, asset, busy } = props
  const { vault } = session
  const [depositInput, setDepositInput] = useState('300')
  const [withdrawInput, setWithdrawInput] = useState('')
  const [lastShock, setLastShock] = useState<number | null>(null)

  const defaulted = vault.status === 'defaulted'
  const hasAvailable = BigInt(vault.availableUnits) > 0n
  const otherBusy = (action: Action) => props.sequencing || (busy !== null && busy !== action)

  const signing =
    props.signerMode === 'keeper'
      ? 'Signed by the keeper (public demo).'
      : props.mocks
        ? 'Signature simulated (demo data).'
        : 'Signed in Freighter.'

  const submit = (handler: (input: string) => void, input: string) => (event: FormEvent) => {
    event.preventDefault()
    handler(input)
  }

  return (
    <Card>
      <div className="grid gap-6">
        <section aria-label="Rate shocks" className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-[0.9375rem] font-medium">Move rates</h3>
            <p className="mt-0.5 text-sm text-ink-subtle">Simulated Euribor shock</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {SHOCKS.map((bp) => (
              <Button
                key={bp}
                variant="sim"
                busy={busy === 'shock' && lastShock === bp}
                disabled={defaulted || props.sequencing || (busy !== null && !(busy === 'shock' && lastShock === bp))}
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

        <div className="grid gap-5 border-t border-line pt-5 sm:grid-cols-2">
          <form onSubmit={submit(props.onDeposit, depositInput)} aria-label="Deposit">
            <label htmlFor="deposit" className="label-caps mb-2 block">
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
            <label htmlFor="withdraw" className="label-caps mb-2 block">
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
      </div>
    </Card>
  )
}
