import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAccessCode, setAccessCode } from '../src/api/access.ts'
import { createHttpClient } from '../src/api/http.ts'

afterEach(() => {
  setAccessCode(null)
  vi.unstubAllGlobals()
})

function stubFetch(status = 200, body: unknown = { sessionId: 's' }) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const headersOf = (call: unknown[]) => (call[1] as RequestInit).headers as Record<string, string>

describe('team access code', () => {
  it('is sent on writes only, as a bearer token', async () => {
    const fetchMock = stubFetch()
    setAccessCode('team-code')
    const client = createHttpClient('https://keeper.example/api')
    await client.getConfig()
    await client.startSession('KMMF')
    expect(headersOf(fetchMock.mock.calls[0]!).authorization).toBeUndefined()
    expect(headersOf(fetchMock.mock.calls[1]!).authorization).toBe('Bearer team-code')
  })

  it('sends nothing when no code is stored', async () => {
    const fetchMock = stubFetch()
    await createHttpClient('https://keeper.example/api').rateShock(10)
    expect(headersOf(fetchMock.mock.calls[0]!).authorization).toBeUndefined()
  })

  it('surfaces a refused code as Unauthorized', async () => {
    stubFetch(401, { error: { code: 'Unauthorized', message: 'A valid access code is required for this action' } })
    await expect(createHttpClient('https://keeper.example/api').settleDefault()).rejects.toMatchObject({ code: 'Unauthorized', status: 401 })
  })

  it('stores and clears the code', () => {
    setAccessCode('abc')
    expect(getAccessCode()).toBe('abc')
    setAccessCode(null)
    expect(getAccessCode()).toBeNull()
  })
})
