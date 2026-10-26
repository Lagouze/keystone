import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ActivityEvent, AssetId, KeystoneConfig, SessionState } from '@keystone/shared'
import { createBackend, type Backend } from '../api/index.ts'
import type { ConnectionStatus } from '../api/client.ts'
import { describeError, KeystoneError } from '../api/errors.ts'
import { formatUnits, parseUnits } from '../lib/format.ts'

/** Validity of a prepared transaction (keeper: 180 s) plus a margin for ledger close. */
const PENDING_WINDOW_MS = 200_000

export type Action = 'start' | 'deposit' | 'withdraw' | 'shock' | 'settle'
type ShownError = { code: string; message: string }

/** Keeps the latest version of each entry (upsert by id), in arrival order. */
function upsert(list: ActivityEvent[], event: ActivityEvent): ActivityEvent[] {
  const index = list.findIndex((e) => e.id === event.id)
  return index === -1 ? [...list, event] : list.map((e, i) => (i === index ? event : e))
}

/**
 * Dashboard state: configuration, session, live activity feed and the scenario actions.
 * Works the same on the real keeper and on the mocks.
 */
export function useKeystone() {
  const backendRef = useRef<Backend | null>(null)
  const [source, setSource] = useState<Backend['client']['source'] | null>(null)
  const [config, setConfig] = useState<KeystoneConfig | null>(null)
  const [session, setSession] = useState<SessionState | null>(null)
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [connection, setConnection] = useState<ConnectionStatus>('connecting')
  const [loadError, setLoadError] = useState<ShownError | null>(null)
  const [busy, setBusy] = useState<Action | null>(null)
  const [step, setStep] = useState<string | null>(null)
  const [error, setError] = useState<ShownError | null>(null)

  const inFlight = useRef(false)
  // When a deposit or withdrawal last ended without a confirmation (RPC timeout): kept here as well,
  // since the pending feed entry may not have reached this tab (stream reconnecting).
  const unconfirmedAt = useRef<number | null>(null)

  /**
   * Shows a new state unless it is older than the one shown (responses and SSE can arrive in
   * either order). Only the stream and "start session" may switch to another session, so a late
   * response about a replaced session cannot bring it back.
   */
  const acceptState = useCallback((next: SessionState, allowSwitch = true) => {
    setSession((current) => {
      if (!current) return next
      if (current.sessionId !== next.sessionId) return allowSwitch ? next : current
      return Date.parse(next.updatedAt) < Date.parse(current.updatedAt) ? current : next
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | undefined
    ;(async () => {
      try {
        const backend = await createBackend()
        if (cancelled) return
        backendRef.current = backend
        setSource(backend.client.source)
        const [cfg, current] = await Promise.all([backend.client.getConfig(), backend.client.getSession()])
        if (cancelled) return
        setConfig(cfg)
        if (current) acceptState(current)
        unsubscribe = backend.client.subscribe({
          onActivity: (event) => setEvents((list) => upsert(list, event)),
          onState: (state) => acceptState(state),
          onConnection: setConnection,
        })
      } catch (e) {
        if (!cancelled) setLoadError(describeError(e))
      }
    })()
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [acceptState])

  const run = useCallback(
    async (action: Action, task: (backend: Backend) => Promise<SessionState>) => {
      const backend = backendRef.current
      // One action at a time: a second click or Enter never sends a second transaction.
      if (!backend || inFlight.current) return
      inFlight.current = true
      setBusy(action)
      setError(null)
      try {
        acceptState(await task(backend), action === 'start')
      } catch (e) {
        if ((action === 'deposit' || action === 'withdraw') && e instanceof KeystoneError && e.code === 'RpcUnavailable') {
          unconfirmedAt.current = Date.now()
        }
        setError(describeError(e))
      } finally {
        inFlight.current = false
        setBusy(null)
        setStep(null)
      }
    },
    [acceptState],
  )

  // Read through refs: the actions stay the same functions from one state to the next, so the
  // panels that receive them are not re-rendered by every SSE update.
  const configRef = useRef(config)
  configRef.current = config
  const sessionRef = useRef(session)
  sessionRef.current = session
  const eventsRef = useRef(events)
  eventsRef.current = events

  const toUnits = useCallback((input: string): string => {
    const asset = configRef.current?.assets.find((a) => a.id === sessionRef.current?.asset)
    try {
      return parseUnits(input, asset?.decimals ?? 7)
    } catch (e) {
      throw new KeystoneError('InvalidInput', e instanceof Error ? e.message : String(e))
    }
  }, [])

  /** Deposit or withdrawal: signed in Freighter, or by the keeper in SIGNER=keeper mode. */
  const moveFunds = useCallback(
    (kind: 'deposit' | 'withdraw', input: string) =>
      run(kind, async ({ client, signer }) => {
        const units = toUnits(input)
        const config = configRef.current
        if (!config) throw new KeystoneError('NotReady', 'Configuration not loaded.')
        const session = sessionRef.current
        // A previous deposit or withdrawal still pending (for example after an RPC timeout) may
        // still land: no second one while it can. Prepared transactions expire 180 s after the
        // keeper builds them, so past PENDING_WINDOW_MS the old one can no longer be included.
        const now = Date.now()
        // An unreadable timestamp counts as recent: blocking is the safe side.
        const recent = (ms: number) => !(now - ms >= PENDING_WINDOW_MS)
        const stillPending =
          (unconfirmedAt.current !== null && recent(unconfirmedAt.current)) ||
          eventsRef.current.some(
            (e) =>
              e.sessionId === session?.sessionId &&
              e.kind === 'chain' &&
              e.status === 'pending' &&
              (e.type === 'deposit' || e.type === 'withdraw') &&
              recent(Date.parse(e.ts)),
          )
        if (stillPending) {
          throw new KeystoneError('PendingTransaction', 'A previous transaction is still pending.')
        }
        // Checked before asking for a signature, from the last confirmed state.
        if (session) {
          const decimals = config.assets.find((a) => a.id === session.asset)?.decimals ?? 7
          const limit = kind === 'deposit' ? session.balances.fundUnits : session.vault.availableUnits
          if (BigInt(units) > BigInt(limit)) {
            throw new KeystoneError(
              'InvalidInput',
              kind === 'deposit'
                ? `The fund holds ${formatUnits(limit, decimals, decimals)} ${session.asset}.`
                : `Only ${formatUnits(limit, decimals, decimals)} ${session.asset} are available to withdraw.`,
            )
          }
        }
        if (config.signerMode === 'keeper') {
          setStep('Submitting…')
          return kind === 'deposit' ? client.deposit(units) : client.withdraw(units)
        }
        setStep('Preparing…')
        const { txXdr } = kind === 'deposit' ? await client.prepareDeposit(units) : await client.prepareWithdraw(units)
        setStep(client.source === 'mocks' ? 'Signing (simulated)…' : 'Confirm in Freighter…')
        const signed = await signer(txXdr, config)
        setStep('Submitting…')
        return client.submit(signed)
      }),
    [run, toUnits],
  )

  const actions = useMemo(
    () => ({
      startSession: (asset: AssetId) => run('start', ({ client }) => client.startSession(asset)),
      deposit: (input: string) => moveFunds('deposit', input),
      withdraw: (input: string) => moveFunds('withdraw', input),
      rateShock: (bp: number) => run('shock', ({ client }) => client.rateShock(bp)),
      settleDefault: () => run('settle', ({ client }) => client.settleDefault()),
      dismissError: () => setError(null),
    }),
    [moveFunds, run],
  )

  // docs/interfaces.md section 4: ignore entries whose sessionId is not the current session.
  const sessionId = session?.sessionId
  const activity = useMemo(
    () => (sessionId ? events.filter((e) => e.sessionId === sessionId).reverse() : []),
    [events, sessionId],
  )

  return {
    source,
    config,
    session,
    activity,
    connection,
    loadError,
    busy,
    step,
    error,
    ...actions,
  }
}

/** Current time, refreshed for countdowns. */
export function useNow(intervalMs = 250, enabled = true): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs, enabled])
  return now
}
