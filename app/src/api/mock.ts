// In-browser mock of the keeper (VITE_USE_MOCKS=true). It follows docs/interfaces.md sections
// 3.3 and 4 closely enough to play both scenarios without a keeper or a wallet. Nothing reaches
// Stellar: every hash and address starts with MOCK. Loaded with a dynamic import, so it is left
// out of the bundle when mocks are off.
import type { ActivityEvent, AssetId, KeystoneConfig, SessionState } from '@keystone/shared'
import { mockConfig, mockConfigKeeperSigner, mockAddress, mockTxHash } from '@keystone/shared/mocks'
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
const whole = (units: bigint) => (units / ONE).toString()

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

  function publishState(): SessionState {
    const s = requireSession()
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
    kind: ActivityEvent['kind'],
    type: ActivityEvent['type'],
    title: string,
    detail?: string,
  ): ActivityEvent {
    sequence += 1
    return {
      id: `mock-${sequence}`,
      sessionId: requireSession().id,
      ts: new Date().toISOString(),
      kind,
      type,
      title,
      ...(detail === undefined ? {} : { detail }),
      status: kind === 'chain' ? 'pending' : 'confirmed',
    }
  }

  /**
   * Plays one mock transaction: the main entry goes out `pending`, then after a short delay the
   * change is applied and the main entry plus the entries it derives are confirmed with one hash.
   */
  async function transaction(
    main: ActivityEvent,
    apply: (now: number) => ActivityEvent[],
  ): Promise<SessionState> {
    publish(main)
    await sleep(CONFIRM_MS)
    const now = Date.now()
    let derived: ActivityEvent[]
    try {
      derived = apply(now)
    } catch (error) {
      publish({ ...main, status: 'failed' })
      throw error
    }
    sequence += 1
    const hash = mockTxHash(sequence)
    const proof = { status: 'confirmed' as const, txHash: hash, explorerUrl: `${config.explorerTxBase}${hash}` }
    publish({ ...main, ...proof })
    derived.forEach((e) => publish({ ...e, ...proof }))
    return publishState()
  }

  /** Entries derived from a rebalance: margin call opened, cured, collateral released. */
  function rebalanceEntries(before: Vault, after: Vault, code: string): ActivityEvent[] {
    const out: ActivityEvent[] = []
    if (before.status === 'active' && after.status === 'margin_call') {
      out.push(
        entry('chain', 'margin_call', `Margin call: ${whole(after.shortfall)} ${code} missing`,
          `Deadline ${new Date(after.callDeadline!).toISOString().slice(11, 19)} UTC`),
      )
    }
    if (before.status === 'margin_call' && after.status === 'active') {
      out.push(entry('chain', 'cured', 'Margin call cured'))
    }
    if (after.locked < before.locked) {
      out.push(entry('chain', 'released', `${whole(before.locked - after.locked)} ${code} released`))
    }
    return out
  }

  function applyDeposit(amount: bigint, now: number, code: string): ActivityEvent[] {
    const s = requireSession()
    if (s.vault.status === 'defaulted') throw new KeystoneError('Defaulted', 'Vault defaulted.', 409)
    if (amount > s.fund) throw new KeystoneError('TxFailed', 'The fund does not hold enough tokens.', 502)
    const before = { ...s.vault }
    s.fund -= amount
    s.vault.available += amount
    rebalance(s.vault, now)
    return rebalanceEntries(before, s.vault, code)
  }

  function applyWithdraw(amount: bigint, now: number): ActivityEvent[] {
    const s = requireSession()
    if (amount > s.vault.available) {
      throw new KeystoneError('InsufficientAvailable', 'Amount above the available collateral.', 409)
    }
    s.vault.available -= amount
    s.fund += amount
    if (s.vault.status !== 'defaulted') rebalance(s.vault, now)
    return []
  }

  function checkSignerMode(expected: KeystoneConfig['signerMode']): void {
    if (config.signerMode !== expected) {
      throw new KeystoneError('SignerModeDisabled', `Route disabled when SIGNER=${config.signerMode}.`, 409)
    }
  }

  async function move(kind: 'deposit' | 'withdraw', units: string): Promise<SessionState> {
    const s = requireSession()
    const amount = parseAmount(units)
    const code = asset(s.asset).code
    const main =
      kind === 'deposit'
        ? entry('chain', 'deposit', `Fund deposited ${whole(amount)} ${code}`)
        : entry('chain', 'withdraw', `Fund withdrew ${whole(amount)} ${code}`)
    return transaction(main, (now) =>
      kind === 'deposit' ? applyDeposit(amount, now, code) : applyWithdraw(amount, now),
    )
  }

  async function prepare(kind: 'deposit' | 'withdraw', units: string) {
    checkSignerMode('freighter')
    requireSession()
    parseAmount(units)
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
      session = {
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
      activity = []
      return transaction(entry('chain', 'session_started', `Vault deployed for ${info.code}`), () => [])
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
      publish({
        ...entry('sim', 'rate_shock', `Rate shock ${sign}${Math.abs(bp)} bp`,
          `Euribor 3M ${from.toFixed(3)} % → ${to.toFixed(3)} %; requirement ${req.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR = ${whole(req.units)} ${info.code}`),
      })
      if (Math.abs(req.value - s.lastPostedValueEur) < MTA_EUR) return publishState()

      const epoch = s.vault.epoch + 1
      const main = entry('chain', 'margin_set', `Requirement posted: ${whole(req.units)} ${info.code}`, `Epoch ${epoch}`)
      return transaction(main, (now) => {
        const before = { ...s.vault }
        s.vault.epoch = epoch
        s.vault.required = req.units
        s.lastPostedValueEur = req.value
        rebalance(s.vault, now)
        return rebalanceEntries(before, s.vault, info.code)
      })
    },

    async settleDefault() {
      const s = requireSession()
      const code = asset(s.asset).code
      const main = entry('chain', 'defaulted', 'Default settled')
      return transaction(main, (now) => {
        const v = s.vault
        if (v.status !== 'margin_call') throw new KeystoneError('NotInMarginCall', 'No open margin call.', 409)
        if (v.callDeadline !== null && now < v.callDeadline) {
          throw new KeystoneError('GracePeriodRunning', 'Grace period still running.', 409)
        }
        if (v.shortfall === 0n) throw new KeystoneError('NoShortfall', 'Nothing is missing.', 409)
        const settled = v.locked
        s.bank += settled
        Object.assign(v, { locked: 0n, required: 0n, shortfall: 0n, callDeadline: null, status: 'defaulted' })
        main.title = `Default settled: ${whole(settled)} ${code} transferred to the bank`
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
