// In-browser mock of the keeper (VITE_USE_MOCKS=true). It follows docs/interfaces.md sections
// 3.3 and 4 closely enough to play both scenarios without a keeper or a wallet. Nothing reaches
// Stellar: every hash and address starts with MOCK. Loaded with a dynamic import, so it is left
// out of the bundle when mocks are off.
import type { ActivityEvent, AssetId, KeystoneConfig, SessionState } from '@keystone/shared'
import { mockConfig, mockConfigKeeperSigner, mockAddress, mockTxHash } from '@keystone/shared/mocks'
import { formatEur, formatUnits } from '../lib/format.ts'
import type { FundSigner, KeeperClient, StreamListener } from './client.ts'
import { KeystoneError } from './errors.ts'

const DECIMALS = 7
const ONE = 10n ** BigInt(DECIMALS)
const CONFIRM_MS = 1200
const GRACE_PERIOD_MS = 90_000
const START_RATE_PCT = 2.034 // same fictitious starting rate as the shared mocks
const NOTIONAL_EUR = 10_000_000
const MTA_EUR = 50_000
const FUND_START_UNITS = 1000n * ONE

type Status = SessionState['vault']['status']

interface Vault {
  available: bigint
  locked: bigint
  required: bigint
  shortfall: bigint
  status: Status
  epoch: number
  callDeadline: number | null
}

interface Session {
  id: string
  asset: AssetId
  vaultId: string
  shockBp: number
  lastPostedValueEur: number
  margin: SessionState['margin']
  vault: Vault
  fund: bigint
  bank: bigint
  updatedAt: string
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const amount = (units: bigint) => formatUnits(units.toString(), DECIMALS, DECIMALS)

/** Plan section 6: flat curve, quarterly payments over 5 years, fund pays fixed. */
function requirement(ratePct: number, unitPriceEur: number, haircutPct: number) {
  const r = ratePct / 100
  let annuity = 0
  for (let i = 1; i <= 20; i++) annuity += 0.25 / (1 + r / 4) ** i
  const mtm = NOTIONAL_EUR * (r - START_RATE_PCT / 100) * annuity
  const value = Math.max(0, -mtm)
  const units = Math.ceil(value / (unitPriceEur * (1 - haircutPct / 100)))
  return { mtm, value, units: BigInt(units) * ONE }
}

/** docs/interfaces.md section 3.3 */
function rebalance(vault: Vault, now: number): void {
  const total = vault.available + vault.locked
  vault.locked = vault.required < total ? vault.required : total
  vault.available = total - vault.locked
  vault.shortfall = vault.required - vault.locked
  if (vault.shortfall > 0n && vault.status === 'active') {
    vault.status = 'margin_call'
    vault.callDeadline = now + GRACE_PERIOD_MS
  } else if (vault.shortfall === 0n && vault.status === 'margin_call') {
    vault.status = 'active'
    vault.callDeadline = null
  }
}

function parseAmount(units: string): bigint {
  if (!/^\d+$/.test(units) || BigInt(units) <= 0n) {
    throw new KeystoneError('BadRequest', 'units must be a positive integer string.', 400)
  }
  return BigInt(units)
}

export function createMockClient(signerMode: KeystoneConfig['signerMode']): KeeperClient {
  const config = signerMode === 'keeper' ? mockConfigKeeperSigner : mockConfig
  const listeners = new Set<StreamListener>()
  let session: Session | null = null
  let activity: ActivityEvent[] = []
  let sequence = 0

  const asset = (id: AssetId) => config.assets.find((a) => a.id === id)!

  function snapshot(s: Session): SessionState {
    const v = s.vault
    return {
      sessionId: s.id,
      asset: s.asset,
      vaultId: s.vaultId,
      updatedAt: s.updatedAt,
      swap: {
        notionalEur: NOTIONAL_EUR.toFixed(2),
        fixedRatePct: START_RATE_PCT.toFixed(3),
        floatRatePct: (START_RATE_PCT + s.shockBp / 100).toFixed(3),
        floatRateSource: s.shockBp === 0 ? 'cache' : 'scenario',
        tenorYears: 5,
        direction: 'fund_pays_fixed',
      },
      margin: s.margin,
      vault: {
        availableUnits: v.available.toString(),
        lockedUnits: v.locked.toString(),
        requiredUnits: v.required.toString(),
        shortfallUnits: v.shortfall.toString(),
        status: v.status,
        epoch: v.epoch,
        callDeadline: v.callDeadline === null ? null : new Date(v.callDeadline).toISOString(),
      },
      balances: { fundUnits: s.fund.toString(), bankUnits: s.bank.toString() },
    }
  }

  function publish(event: ActivityEvent): void {
    const index = activity.findIndex((e) => e.id === event.id)
    activity = index === -1 ? [...activity, event] : activity.map((e, i) => (i === index ? event : e))
    listeners.forEach((l) => l.onActivity(event))
  }

  function publishState(s: Session): SessionState {
    s.updatedAt = new Date().toISOString()
    const state = snapshot(s)
    listeners.forEach((l) => l.onState(state))
    return state
  }

  function requireSession(): Session {
    if (!session) throw new KeystoneError('NoSession', 'No active session.', 404)
    return session
  }

  function entry(
    s: Session,
    kind: ActivityEvent['kind'],
    type: ActivityEvent['type'],
    title: string,
    detail?: string,
  ): ActivityEvent {
    sequence += 1
    return {
      id: `mock-${sequence}`,
      sessionId: s.id,
      ts: new Date().toISOString(),
      kind,
      type,
      title,
      ...(detail === undefined ? {} : { detail }),
      status: kind === 'chain' ? 'pending' : 'confirmed',
    }
  }

  /**
   * Plays one mock transaction on session `s`, once its checks have passed: the main entry goes
   * out `pending`, then after a short delay the change is applied and the main entry plus the
   * entries it derives are confirmed with one hash.
   */
  async function transaction(
    s: Session,
    main: ActivityEvent,
    apply: (now: number) => ActivityEvent[],
  ): Promise<SessionState> {
    publish(main)
    await sleep(CONFIRM_MS)
    if (session !== s) {
      publish({ ...main, status: 'failed' })
      throw new KeystoneError('TxFailed', 'The session was replaced before confirmation.', 502)
    }
    const derived = apply(Date.now())
    sequence += 1
    const hash = mockTxHash(sequence)
    const proof = { status: 'confirmed' as const, txHash: hash, explorerUrl: `${config.explorerTxBase}${hash}` }
    publish({ ...main, ...proof })
    derived.forEach((e) => publish({ ...e, ...proof }))
    return publishState(s)
  }

  /** Entries derived from a rebalance: margin call opened, cured, collateral released. */
  function rebalanceEntries(s: Session, before: Vault, code: string): ActivityEvent[] {
    const after = s.vault
    const out: ActivityEvent[] = []
    if (before.status === 'active' && after.status === 'margin_call') {
      out.push(
        entry(s, 'chain', 'margin_call', `Margin call: ${amount(after.shortfall)} ${code} missing`,
          `Deadline ${new Date(after.callDeadline!).toISOString().slice(11, 19)} UTC`),
      )
    }
    if (before.status === 'margin_call' && after.status === 'active') {
      out.push(entry(s, 'chain', 'cured', 'Margin call cured'))
    }
    if (after.locked < before.locked) {
      out.push(entry(s, 'chain', 'released', `${amount(before.locked - after.locked)} ${code} released`))
    }
    return out
  }

  /** What the keeper's simulation would reject before any transaction is sent. */
  function checkMove(s: Session, kind: 'deposit' | 'withdraw', value: bigint): void {
    if (kind === 'deposit') {
      if (s.vault.status === 'defaulted') throw new KeystoneError('Defaulted', 'Vault defaulted.', 409)
      if (value > s.fund) throw new KeystoneError('TxFailed', 'The fund does not hold enough tokens.', 502)
    } else if (value > s.vault.available) {
      throw new KeystoneError('InsufficientAvailable', 'Amount above the available collateral.', 409)
    }
  }

  function checkSignerMode(expected: KeystoneConfig['signerMode']): void {
    if (config.signerMode !== expected) {
      throw new KeystoneError('SignerModeDisabled', `Route disabled when SIGNER=${config.signerMode}.`, 409)
    }
  }

  async function move(kind: 'deposit' | 'withdraw', units: string): Promise<SessionState> {
    const s = requireSession()
    const value = parseAmount(units)
    checkMove(s, kind, value)
    const code = asset(s.asset).code
    const main =
      kind === 'deposit'
        ? entry(s, 'chain', 'deposit', `Fund deposited ${amount(value)} ${code}`)
        : entry(s, 'chain', 'withdraw', `Fund withdrew ${amount(value)} ${code}`)
    return transaction(s, main, (now) => {
      const before = { ...s.vault }
      if (kind === 'deposit') {
        s.fund -= value
        s.vault.available += value
      } else {
        s.vault.available -= value
        s.fund += value
      }
      // No rebalancing after a default (section 3.3).
      if (s.vault.status === 'defaulted') return []
      rebalance(s.vault, now)
      return rebalanceEntries(s, before, code)
    })
  }

  async function prepare(kind: 'deposit' | 'withdraw', units: string) {
    checkSignerMode('freighter')
    const s = requireSession()
    checkMove(s, kind, parseAmount(units))
    await sleep(300)
    return { txXdr: `MOCK-XDR:${kind}:${units}` }
  }

  return {
    source: 'mocks',
    getConfig: async () => config,
    getSession: async () => (session ? snapshot(session) : null),

    async startSession(id) {
      const info = asset(id)
      sequence += 1
      const s: Session = {
        id: `mock-session-${id.toLowerCase()}-${sequence}`,
        asset: id,
        vaultId: mockAddress('C', `VAULT${sequence}`),
        shockBp: 0,
        lastPostedValueEur: 0,
        margin: {
          mtmFundEur: '0.00',
          thresholdEur: '0.00',
          mtaEur: MTA_EUR.toFixed(2),
          requiredValueEur: '0.00',
          unitPriceEur: info.unitPriceEur,
          haircutPct: info.haircutPct,
          requiredUnits: '0',
        },
        vault: { available: 0n, locked: 0n, required: 0n, shortfall: 0n, status: 'active', epoch: 0, callDeadline: null },
        fund: FUND_START_UNITS,
        bank: 0n,
        updatedAt: new Date().toISOString(),
      }
      session = s
      activity = []
      return transaction(s, entry(s, 'chain', 'session_started', `Vault deployed for ${info.code}`), () => [])
    },

    prepareDeposit: (units) => prepare('deposit', units),
    prepareWithdraw: (units) => prepare('withdraw', units),

    async submit(signedTxXdr) {
      checkSignerMode('freighter')
      const match = /^MOCK-XDR:(deposit|withdraw):(\d+):MOCK-SIGNED$/.exec(signedTxXdr)
      if (!match) throw new KeystoneError('TxFailed', 'Not a signed mock transaction.', 502)
      return move(match[1] as 'deposit' | 'withdraw', match[2]!)
    },

    async deposit(units) {
      checkSignerMode('keeper')
      return move('deposit', units)
    },

    async withdraw(units) {
      checkSignerMode('keeper')
      return move('withdraw', units)
    },

    async rateShock(bp) {
      const s = requireSession()
      if (s.vault.status === 'defaulted') {
        throw new KeystoneError('Defaulted', 'The vault has defaulted: the margin is frozen.', 409)
      }
      const info = asset(s.asset)
      const from = START_RATE_PCT + s.shockBp / 100
      s.shockBp += bp
      const to = START_RATE_PCT + s.shockBp / 100
      const req = requirement(to, Number(info.unitPriceEur), Number(info.haircutPct))
      s.margin = {
        ...s.margin,
        mtmFundEur: req.mtm.toFixed(2),
        requiredValueEur: req.value.toFixed(2),
        requiredUnits: req.units.toString(),
      }
      const sign = bp > 0 ? '+' : '−'
      publish(
        entry(s, 'sim', 'rate_shock', `Rate shock ${sign}${Math.abs(bp)} bp`,
          `Euribor 3M ${from.toFixed(3)} % → ${to.toFixed(3)} %; requirement ${formatEur(req.value.toFixed(2))} EUR = ${amount(req.units)} ${info.code}`),
      )
      // Section 4: below the MTA, no transaction, only the sim entry.
      if (Math.abs(req.value - s.lastPostedValueEur) < MTA_EUR) return publishState(s)

      const epoch = s.vault.epoch + 1
      const main = entry(s, 'chain', 'margin_set', `Requirement posted: ${amount(req.units)} ${info.code}`, `Epoch ${epoch}`)
      return transaction(s, main, (now) => {
        const before = { ...s.vault }
        s.vault.epoch = epoch
        s.vault.required = req.units
        s.lastPostedValueEur = req.value
        rebalance(s.vault, now)
        return rebalanceEntries(s, before, info.code)
      })
    },

    async settleDefault() {
      const s = requireSession()
      const v = s.vault
      if (v.status !== 'margin_call') throw new KeystoneError('NotInMarginCall', 'No open margin call.', 409)
      if (v.callDeadline !== null && Date.now() < v.callDeadline) {
        throw new KeystoneError('GracePeriodRunning', 'Grace period still running.', 409)
      }
      if (v.shortfall === 0n) throw new KeystoneError('NoShortfall', 'Nothing is missing.', 409)
      const settled = v.locked
      const code = asset(s.asset).code
      const main = entry(s, 'chain', 'defaulted', `Default settled: ${amount(settled)} ${code} transferred to the bank`)
      return transaction(s, main, () => {
        s.bank += settled
        Object.assign(v, { locked: 0n, required: 0n, shortfall: 0n, callDeadline: null, status: 'defaulted' })
        return []
      })
    },

    subscribe(listener) {
      listeners.add(listener)
      listener.onConnection('open')
      activity.forEach((e) => listener.onActivity(e))
      if (session) listener.onState(snapshot(session))
      return () => listeners.delete(listener)
    },
  }
}

/** Stands in for Freighter in mocks mode: no extension involved, nothing is signed. */
export const mockSigner: FundSigner = async (txXdr) => {
  await sleep(500)
  return `${txXdr}:MOCK-SIGNED`
}
