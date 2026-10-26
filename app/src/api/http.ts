import type { ActivityEvent, ApiError, AssetId, KeystoneConfig, MarketSnapshot, SessionState } from '@keystone/shared'
import type { KeeperClient, StreamListener } from './client.ts'
import { KeystoneError } from './errors.ts'

/** Advisor deliberately uses only this GET, even while session actions run in mock mode. */
export async function getMarketSnapshot(baseUrl: string, signal: AbortSignal): Promise<MarketSnapshot> {
  const response = await fetch(`${baseUrl}/market-advisor`, { method: 'GET', signal })
  if (!response.ok) throw new Error('Market provider unavailable.')
  const data = await response.json() as MarketSnapshot
  const ids = ['vix', 'sovereignVol', 'euribor3m', 'sovereign2y', 'estr']
  const outcomes = ['KMMF potentially preferable', 'KBOND potentially preferable', 'No clear preference', 'Insufficient market data']
  const criteriaIds = ['duration', 'stability', 'liquidity', 'yield', 'valuation']
  const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
  const score = (value: unknown) => finite(value) && value >= 0 && value <= 100
  const dateOrNull = (value: unknown) => value === null || (typeof value === 'string' && Number.isFinite(Date.parse(value)))
  const advice = data?.advice
  if (!data || typeof data.asOf !== 'string' || !Number.isFinite(Date.parse(data.asOf))
    || !Array.isArray(data.metrics) || data.metrics.length !== 5 || !ids.every((id) => data.metrics.some((m) => m?.id === id))
    || !data.metrics.every((m) => m && typeof m.name === 'string' && typeof m.unit === 'string' && typeof m.note === 'string'
      && (m.value === null || (typeof m.value === 'string' && m.value.trim() !== '' && Number.isFinite(Number(m.value))))
      && dateOrNull(m.observedAt) && dateOrNull(m.retrievedAt)
      && typeof m.source?.name === 'string' && typeof m.source?.url === 'string' && typeof m.source?.series === 'string'
      && ['daily close', 'daily', 'monthly average'].includes(m.frequency)
      && ['source', 'cache', 'unavailable', 'restricted'].includes(m.delivery) && ['current', 'stale', 'unknown'].includes(m.freshness)
      && (m.calculation === undefined || (typeof m.calculation?.method === 'string' && typeof m.calculation.start === 'string'
        && typeof m.calculation.end === 'string' && finite(m.calculation.observations) && Number.isInteger(m.calculation.observations))))
    || !advice || !outcomes.includes(advice.outcome) || typeof advice.explanation !== 'string'
    || !advice.weights || !criteriaIds.every((id) => finite(advice.weights[id as keyof typeof advice.weights]) && advice.weights[id as keyof typeof advice.weights] >= 0)
    || (advice.scores !== null && (!score(advice.scores?.KMMF) || !score(advice.scores?.KBOND)))
    || !Array.isArray(advice.criteria) || !advice.criteria.every((c) => c && criteriaIds.includes(c.id)
      && typeof c.label === 'string' && typeof c.explanation === 'string' && finite(c.weight) && c.weight >= 0 && score(c.KMMF) && score(c.KBOND)
      && Array.isArray(c.metrics) && c.metrics.every((id) => ids.includes(id)))
    || !Array.isArray(advice.limits) || !advice.limits.every((limit) => typeof limit === 'string')) throw new Error('Invalid market response.')
  return data
}

/** Client of the real keeper: REST routes and the SSE stream of docs/interfaces.md section 4. */
export function createHttpClient(baseUrl: string): KeeperClient {
  async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    let response: Response
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: body === undefined ? undefined : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch {
      throw new KeystoneError('KeeperUnreachable', `No answer from ${baseUrl}.`)
    }
    const text = await response.text()
    let data: unknown = null
    if (text) {
      try {
        data = JSON.parse(text)
      } catch {
        data = null
      }
    }
    if (!response.ok) {
      const error = (data as Partial<ApiError> | null)?.error
      throw new KeystoneError(
        error?.code ?? `Http${response.status}`,
        error?.message ?? `The keeper answered HTTP ${response.status}.`,
        response.status,
      )
    }
    return data as T
  }

  return {
    source: 'keeper',
    getConfig: () => request<KeystoneConfig>('GET', '/config'),
    async getSession() {
      try {
        return await request<SessionState>('GET', '/session')
      } catch (error) {
        if (error instanceof KeystoneError && error.code === 'NoSession') return null
        throw error
      }
    },
    startSession: (asset: AssetId) => request<SessionState>('POST', '/session', { asset }),
    prepareDeposit: (units) => request('POST', '/session/deposit/prepare', { units }),
    prepareWithdraw: (units) => request('POST', '/session/withdraw/prepare', { units }),
    submit: (signedTxXdr) => request('POST', '/session/submit', { signedTxXdr }),
    deposit: (units) => request('POST', '/session/deposit', { units }),
    withdraw: (units) => request('POST', '/session/withdraw', { units }),
    rateShock: (bp) => request('POST', '/session/rate-shock', { bp }),
    settleDefault: () => request('POST', '/session/settle-default'),
    subscribe(listener: StreamListener) {
      let source: EventSource | null = null
      let retry: number | undefined
      let closed = false

      const parse = <T,>(message: Event): T | null => {
        try {
          return JSON.parse((message as MessageEvent<string>).data) as T
        } catch {
          console.warn('Unreadable SSE message', message)
          return null
        }
      }

      const open = () => {
        source = new EventSource(`${baseUrl}/events`)
        source.addEventListener('open', () => listener.onConnection('open'))
        source.addEventListener('error', () => {
          listener.onConnection('reconnecting')
          // EventSource retries by itself, except after an HTTP error or a wrong content type.
          if (source?.readyState === EventSource.CLOSED && !closed) {
            retry = window.setTimeout(open, 3000)
          }
        })
        // The keeper replays the whole history on every connection.
        source.addEventListener('activity', (message) => {
          const event = parse<ActivityEvent>(message)
          if (event?.id) listener.onActivity(event)
        })
        source.addEventListener('state', (message) => {
          const state = parse<SessionState>(message)
          if (state?.sessionId) listener.onState(state)
        })
      }

      listener.onConnection('connecting')
      open()
      return () => {
        closed = true
        window.clearTimeout(retry)
        source?.close()
      }
    },
  }
}
