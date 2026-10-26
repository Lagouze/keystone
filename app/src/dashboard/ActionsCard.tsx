import { useState, type FormEvent } from 'react'
import type { AssetInfo, KeystoneConfig, SessionState } from '@keystone/shared'
import type { Action } from '../state/useKeystone.ts'
import { Button, Card, SegmentedControl } from '../ui/index.ts'

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
  'h-11 w-full min-w-0 rounded-full bg-white/45 px-5 text-sm tabular-nums text-ink shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6)] ' +
  'placeholder:text-ink-subtle focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-chain disabled:opacity-50'

type Mode = 'deposit' | 'withdraw'

/** One panel for everything the user can do: move rates (simulated), then deposit or withdraw. */
export function ActionsCard(props: ActionsCardProps) {
  const { session, asset, busy } = props
  const { vault } = session
  const [mode, setMode] = useState<Mode>('deposit')
  const [inputs, setInputs] = useState<Record<Mode, string>>({ deposit: '300', withdraw: '' })
  const [lastShock, setLastShock] = useState<number | null>(null)

  const defaulted = vault.status === 'defaulted'
  const hasAvailable = BigInt(vault.availableUnits) > 0n
  const otherBusy = (action: Action) => props.sequencing || (busy !== null && busy !== action)
  const withdrawBlocked = mode === 'withdraw' && !hasAvailable

  const signing =
    props.signerMode === 'keeper'
      ? 'Signed by the keeper (public demo).'
      : props.mocks
        ? 'Signature simulated (demo data).'
        : 'Signed in Freighter.'

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (mode === 'deposit') props.onDeposit(inputs.deposit)
    else props.onWithdraw(inputs.withdraw)
  }

  return (
    <Card title="Controls" className="min-h-60">
      <div className="grid gap-8">
        <section aria-label="Rate shocks" className="grid gap-3">
          <p className="text-sm text-ink-subtle">Move rates · simulated Euribor shock</p>
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

        <form onSubmit={submit} aria-label="Deposit or withdraw" className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label htmlFor="amount" className="text-sm text-ink-subtle">
              {mode === 'deposit' ? 'Deposit' : 'Withdraw'} {asset.code}
            </label>
            <SegmentedControl
              label="Operation"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'deposit', label: 'Deposit' },
                { value: 'withdraw', label: 'Withdraw' },
              ]}
            />
          </div>
          <div className="flex gap-2">
            <input
              id="amount"
              className={inputClass}
              inputMode="decimal"
              placeholder="0"
              value={inputs[mode]}
              onChange={(e) => setInputs({ ...inputs, [mode]: e.target.value })}
              disabled={mode === 'deposit' ? defaulted : !hasAvailable}
            />
            <Button
              type="submit"
              variant="primary"
              className="shrink-0"
              busy={busy === mode}
              disabled={(mode === 'deposit' && defaulted) || withdrawBlocked || otherBusy(mode)}
            >
              {busy === mode
                ? (props.step ?? (mode === 'deposit' ? 'Depositing…' : 'Withdrawing…'))
                : mode === 'deposit'
                  ? 'Deposit'
                  : 'Withdraw'}
            </Button>
          </div>
          <p className="text-xs text-ink-subtle">{signing}</p>
        </form>
      </div>
    </Card>
  )
}
