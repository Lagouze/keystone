import type { AssetInfo, KeystoneConfig, SessionState } from '@keystone/shared'
import { formatCountdown, formatEur, formatUnits, formatUtcTime } from '../lib/format.ts'
import type { Action } from '../state/useKeystone.ts'
import { Button, Card, StatusPill } from '../ui/index.ts'

interface StatusCardProps {
  session: SessionState
  asset: AssetInfo
  signerMode: KeystoneConfig['signerMode']
  busy: Action | null
  step: string | null
  now: number
  onDeposit(input: string): void
  onSettle(): void
}

/**
 * Flighty-style status: what is happening, by how much, and until when. The margin-call card is
 * the only tinted one on the screen.
 */
export function StatusCard(props: StatusCardProps) {
  const { session, asset, busy, now } = props
  const { vault, margin } = session
  const fmt = (units: string) => formatUnits(units, asset.decimals)
  const code = asset.code
  const countdown = vault.callDeadline ? formatCountdown(vault.callDeadline, now) : null
  const deadlinePassed = vault.status === 'margin_call' && vault.callDeadline !== null && countdown === null
  const otherBusy = (action: Action) => busy !== null && busy !== action

  let headline: string
  let detail: string
  if (vault.status === 'margin_call') {
    headline = `${fmt(vault.shortfallUnits)} ${code} missing. Cover before ${
      vault.callDeadline ? formatUtcTime(vault.callDeadline) : '—'
    } UTC, or the ${fmt(vault.lockedUnits)} locked ${code} go to the bank.`
    detail = `The fund's loss now requires ${formatEur(margin.requiredValueEur)} EUR of collateral, ${fmt(
      vault.requiredUnits,
    )} ${code} after the ${margin.haircutPct}% haircut. The vault already locks all it holds.`
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
    detail = `The vault locks ${fmt(vault.lockedUnits)} ${code}, exactly what the margin requires (${formatEur(
      margin.requiredValueEur,
    )} EUR after haircut). No cash set aside.`
  }

  return (
    <Card tone={vault.status === 'margin_call' ? 'call' : vault.status === 'defaulted' ? 'default-settled' : 'default'}>
      <div className="grid items-start gap-6 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex max-w-2xl flex-col items-start gap-3">
          <StatusPill status={vault.status} />
          <h2 className="text-2xl leading-snug tracking-tight sm:text-[1.75rem]">{headline}</h2>
          <p className="text-[0.9375rem] leading-relaxed text-ink-muted">{detail}</p>
        </div>
        {vault.status === 'margin_call' && (
          <div className="flex flex-col items-end gap-1">
            <span className="label-caps">Grace period</span>
            <span className="text-5xl font-light leading-none tabular-nums text-warning-ink">{countdown ?? '00:00'}</span>
          </div>
        )}
      </div>

      {vault.status === 'margin_call' && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            busy={busy === 'deposit'}
            disabled={otherBusy('deposit')}
            onClick={() => props.onDeposit(formatUnits(vault.shortfallUnits, asset.decimals, asset.decimals).replace(/,/g, ''))}
          >
            {busy === 'deposit' ? (props.step ?? 'Depositing…') : `Deposit ${fmt(vault.shortfallUnits)} ${code}`}
          </Button>
          <Button variant="danger" busy={busy === 'settle'} disabled={!deadlinePassed || otherBusy('settle')} onClick={props.onSettle}>
            {deadlinePassed ? 'Settle default' : 'Settle default · after deadline'}
          </Button>
          <span className="text-sm text-ink-subtle">
            {props.signerMode === 'keeper' ? 'Signed by the keeper (public demo)' : 'Signed by the fund in Freighter'}
          </span>
        </div>
      )}
    </Card>
  )
}
