import type { ActivityEvent, ApiError, AssetId, KeystoneConfig, SessionState } from '@keystone/shared'
import type { KeeperClient, StreamListener } from './client.ts'
import { KeystoneError } from './errors.ts'

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
      const source = new EventSource(`${baseUrl}/events`)
      listener.onConnection('connecting')
      source.addEventListener('open', () => listener.onConnection('open'))
      // EventSource reconnects by itself; the keeper replays the history on every connection.
      source.addEventListener('error', () => listener.onConnection('reconnecting'))
      source.addEventListener('activity', (message) => {
        listener.onActivity(JSON.parse((message as MessageEvent<string>).data) as ActivityEvent)
      })
      source.addEventListener('state', (message) => {
        listener.onState(JSON.parse((message as MessageEvent<string>).data) as SessionState)
      })
      return () => source.close()
    },
  }
}
