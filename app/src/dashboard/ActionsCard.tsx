import { useState, type FormEvent, memo } from 'react'
import { motion } from 'motion/react'
import type { AssetInfo, KeystoneConfig, SessionState } from '@keystone/shared'
import type { Action } from '../state/useKeystone.ts'
import { AutoHeight } from '../ui/AutoHeight.tsx'
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
  'h-11 w-full min-w-0 rounded-full bg-white/45 px-5 text-sm tabular-nums text-ink  ' +
  'placeholder:text-ink-subtle focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-chain disabled:opacity-50'

type Mode = 'deposit' | 'withdraw'

/** One panel for everything the user can do: move rates (simulated), then deposit or withdraw. */
export const ActionsCard = memo(function ActionsCard(props: ActionsCardProps) {
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
      <AutoHeight>
        <div className="grid gap-8">
          <section aria-label="Rate shocks" className="grid gap-3">
            <p className="text-sm text-ink-subtle">Move rates · simulated Euribor shock</p>
            <div className="grid grid-cols-4 gap-2 sm:gap-3">
              {SHOCKS.map((bp, i) => {
                const mine = busy === 'shock' && lastShock === bp
                const off = defaulted || props.sequencing || (busy !== null && !mine)
                return (
                  <motion.button
                    key={bp}
                    type="button"
                    disabled={off}
                    aria-busy={mine || undefined}
                    onClick={() => {
                      setLastShock(bp)
                      props.onShock(bp)
                    }}
                    // Icon tiles of the references: a soft glass tile, a trend arrow, the shock under it.
                    className="glass flex flex-col items-center gap-2 rounded-3xl px-2 py-4 text-ink shadow-card transition-colors enabled:hover:bg-white/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chain disabled:cursor-not-allowed disabled:opacity-45"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: i % 2 ? 4 : 0 }}
                    whileHover={off ? undefined : { y: -4 }}
                    whileTap={off ? undefined : { scale: 0.94 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 26, delay: i * 0.05 }}
                  >
                    <span aria-hidden="true" className={bp > 0 ? 'text-success' : 'text-danger'}>
                      {mine ? (
                        <span className="flex h-6 items-center gap-1">
                          {[0, 1, 2].map((n) => (
                            <span key={n} className="size-1 rounded-full bg-current motion-safe:animate-dot" style={{ animationDelay: `${n * 0.15}s` }} />
                          ))}
                        </span>
                      ) : (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          {bp > 0 ? (
                            <>
                              <path d="M3 17l6-6 4 4 8-8" />
                              <path d="M15 7h6v6" />
                            </>
                          ) : (
                            <>
                              <path d="M3 7l6 6 4-4 8 8" />
                              <path d="M15 17h6v-6" />
                            </>
                          )}
                        </svg>
                      )}
                    </span>
                    <span className="text-sm font-medium tabular-nums">
                      {bp > 0 ? '+' : '−'}
                      {Math.abs(bp)} bp
                    </span>
                  </motion.button>
                )
              })}
            </div>
          </section>

          <form onSubmit={submit} aria-label="Deposit or withdraw" className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label htmlFor="amount" className="text-sm text-ink-subtle">
                {mode === 'deposit' ? 'Deposit' : 'Withdraw'} {asset.code}
              </label>
              <SegmentedControl
                label="Operation mode"
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
      </AutoHeight>
    </Card>
  )
})
