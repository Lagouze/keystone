import { afterEach, expect, it, vi } from 'vitest'
import { getMarketSnapshot } from '../src/api/http.ts'

afterEach(() => vi.unstubAllGlobals())
it('rejects incomplete nested market payloads rather than crashing the rendering component', async () => {
  const data = { asOf: '2026-10-26T00:00:00Z', metrics: ['vix', 'sovereignVol', 'euribor3m', 'sovereign2y', 'estr'].map((id) => ({ id })), advice: { outcome: 'Insufficient market data', criteria: [], limits: [] } }
  const fetchFn = vi.fn(async () => new Response(JSON.stringify(data)))
  vi.stubGlobal('fetch', fetchFn)
  await expect(getMarketSnapshot('http://localhost/api', new AbortController().signal)).rejects.toThrow('Invalid market response')
  expect(fetchFn).toHaveBeenCalledWith('http://localhost/api/market-advisor', expect.objectContaining({ method: 'GET' }))
})
it('rejects HTTP failures', async () => {
  vi.stubGlobal('fetch', async () => new Response('', { status: 503 }))
  await expect(getMarketSnapshot('http://localhost/api', new AbortController().signal)).rejects.toThrow('Market provider unavailable')
})
