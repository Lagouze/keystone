import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ActivityEvent, AssetId, KeystoneConfig, SessionState } from '@keystone/shared'
import { createBackend, type Backend } from '../api/index.ts'
import type { ConnectionStatus } from '../api/client.ts'
import { describeError, KeystoneError } from '../api/errors.ts'
import { parseUnits } from '../lib/format.ts'

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

  // Ignore a state older than the one shown (responses and SSE can arrive in either order).
  const acceptState = useCallback((next: SessionState) => {
    setSession((current) =>
      current &&
      current.sessionId === next.sessionId &&
      Date.parse(next.updatedAt) < Date.parse(current.updatedAt)
        ? current
        : next,
    )
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
          onState: acceptState,
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
      if (!backend) return
      setBusy(action)
      setError(null)
      try {
        acceptState(await task(backend))
      } catch (e) {
        setError(describeError(e))
      } finally {
        setBusy(null)
        setStep(null)
      }
    },
    [acceptState],
  )

  const toUnits = useCallback(
    (input: string): string => {
      const asset = config?.assets.find((a) => a.id === session?.asset)
      try {
        return parseUnits(input, asset?.decimals ?? 7)
      } catch (e) {
        throw new KeystoneError('InvalidInput', e instanceof Error ? e.message : String(e))
      }
    },
    [config, session],
  )

  /** Deposit or withdrawal: signed in Freighter, or by the keeper in SIGNER=keeper mode. */
  const moveFunds = useCallback(
    (kind: 'deposit' | 'withdraw', input: string) =>
      run(kind, async ({ client, signer }) => {
        const units = toUnits(input)
        if (!config) throw new KeystoneError('NoSession', 'Configuration not loaded.')
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
    [config, run, toUnits],
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

  // A new session clears the history (section 4): drop entries of previous sessions.
  const sessionId = session?.sessionId
  useEffect(() => {
    if (sessionId) setEvents((list) => list.filter((e) => e.sessionId === sessionId))
  }, [sessionId])

  // docs/interfaces.md section 4: ignore entries whose sessionId is not the current session.
  const activity = useMemo(
    () => (session ? events.filter((e) => e.sessionId === session.sessionId).reverse() : []),
    [events, session],
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
export function useNow(intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs])
  return now
}
