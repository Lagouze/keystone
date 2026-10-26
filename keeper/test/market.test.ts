import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AdvisorWeights, MarketMetric, MarketMetricId } from '@keystone/shared';
import { createMarketProvider, MARKET_URLS, parseObservations, parseYahooVix, realizedVolatility, unavailableMarket } from '../src/market-data.ts';
import { DEFAULT_WEIGHTS, scoreMarket } from '../src/market-scoring.ts';
import { buildServer } from '../src/server.ts';
import { config, makeKeeper } from './helpers.ts';

const now = new Date('2026-10-26T12:00:00Z');
// Synthetic unit-test observations, never shipped as market values.
const history = Array.from({ length: 21 }, (_, i) => ({ date: new Date(Date.UTC(2026, 9, i + 2)).toISOString().slice(0, 10), value: 2 + (i % 2 ? 0.1 : 0) }));
const csv = (rows = history) => 'TIME_PERIOD,OBS_VALUE,TITLE\n' + rows.map((o) => `${o.date},${o.value},"quoted, title"`).join('\n');
const unix = (iso: string) => Date.parse(iso) / 1000;
const yahoo = () => ({ chart: { error: null, result: [{
  meta: { symbol: '^VIX', dataGranularity: '1d', exchangeTimezoneName: 'America/Chicago', regularMarketPrice: 99,
    currentTradingPeriod: { regular: { start: unix('2026-10-23T07:00:00Z'), end: unix('2026-10-23T20:15:00Z') } } },
  timestamp: [unix('2026-10-22T07:00:00Z'), unix('2026-10-23T07:00:00Z')],
  indicators: { quote: [{ close: [19.03, 19.45] }] },
}] } });
const fetchFn = vi.fn(async (url: string | URL | Request) => new Response(
  String(url) === MARKET_URLS.euribor3m ? 'TIME_PERIOD,OBS_VALUE\n2026-09,2.635'
    : String(url) === MARKET_URLS.vix ? JSON.stringify(yahoo())
      : String(url) === MARKET_URLS.estr ? 'TIME_PERIOD,OBS_VALUE\n2026-10-22,2.442' : csv())) as unknown as typeof fetch;
afterEach(() => vi.clearAllMocks());

describe('verifiable data and realized yield volatility', () => {
  it('parses by column name, sorts, allows negative rates, excludes missing, nonfinite and future values', () => {
    expect(parseObservations('OBS_VALUE,TIME_PERIOD,TITLE\n-0.1,2026-10-20,"a, b"\n,2026-10-21,x\n3,2027-01-01,x\nNaN,2026-10-22,x', 'ecb', now)).toEqual([{ date: '2026-10-20', value: -0.1 }]);
    expect(parseObservations('DATE,CLOSE\n10/23/2026,19.45', 'vix', now)[0]).toEqual({ date: '2026-10-23', value: 19.45 });
    expect(() => parseObservations('DATE,CLOSE\n02/31/2026,2', 'vix', now)).toThrow();
    expect(() => parseObservations('TIME_PERIOD,OBS_VALUE\n2026-10-20,1\n2026-10-20,2', 'ecb', now)).toThrow();
  });
  it('matches a hand-computable sample SD in bp/day with 21 observations / 20 changes', () => {
    expect(realizedVolatility(history).value).toBeCloseTo(Math.sqrt(2000 / 19), 8);
    expect(realizedVolatility(history)).toMatchObject({ start: '2026-10-02', end: '2026-10-22', observations: 21 });
    expect(() => realizedVolatility(history.slice(1))).toThrow();
    expect(realizedVolatility(history.map((o) => ({ ...o, value: 2 }))).value).toBe(0);
    expect(() => realizedVolatility(history.map((o, i) => i === 0 ? { ...o, date: '2026-09-01' } : o))).toThrow();
  });
  it('fetches Yahoo VIX automatically, deduplicates requests, labels in-memory reuse as cache', async () => {
    const provider = createMarketProvider({ fetchFn, now: () => now });
    const [a, b] = await Promise.all([provider(), provider()]);
    expect(a).toEqual(b);
    expect(fetchFn).toHaveBeenCalledTimes(4);
    expect(a.metrics.find((m) => m.id === 'vix')).toMatchObject({ value: '19.450000', observedAt: '2026-10-23', delivery: 'source', freshness: 'current', source: { name: 'Yahoo Finance / Cboe' } });
    expect(a.metrics.find((m) => m.id === 'euribor3m')).toMatchObject({ value: '2.635000', observedAt: '2026-09', frequency: 'monthly average' });
    expect(a.metrics.filter((m) => m.value !== null)).toHaveLength(5);
    expect((await provider()).metrics.find((m) => m.id === 'estr')?.delivery).toBe('cache');
    expect(fetchFn).toHaveBeenCalledTimes(4);
  });
  it('accepts the complete TARGET Easter holiday gap between published business observations', () => {
    const days = Array.from({ length: 50 }, (_, i) => new Date(Date.UTC(2026, 2, i + 1)))
      .filter((d) => d.getUTCDay() !== 0 && d.getUTCDay() !== 6)
      .map((d) => d.toISOString().slice(0, 10)).filter((d) => d !== '2026-04-03' && d !== '2026-04-06');
    const end = days.indexOf('2026-04-07');
    const observations = days.slice(end - 20, end + 1).map((date) => ({ date, value: 2 }));
    expect(observations).toHaveLength(21);
    expect(realizedVolatility(observations).value).toBe(0);
  });
  it('uses fresh Yahoo VIX as secondary scoring input and never relabels realized volatility MOVE', async () => {
    const highVix = yahoo(); highVix.chart.result[0]!.indicators.quote[0]!.close[1] = 40;
    const data = await createMarketProvider({ fetchFn: (async (url) => String(url) === MARKET_URLS.vix ? new Response(JSON.stringify(highVix)) : fetchFn(url)) as typeof fetch, now: () => now })();
    expect(data.metrics.find((m) => m.id === 'vix')).toMatchObject({ value: '40.000000', observedAt: '2026-10-23' });
    expect(data.advice.criteria.find((c) => c.id === 'valuation')?.metrics).toContain('vix');
    const withoutVix = scoreMarket(data.metrics.filter((m) => m.id !== 'vix')).scores!;
    expect(data.advice.scores!.KMMF).toBeLessThan(withoutVix.KMMF);
    expect(data.advice.scores!.KBOND).toBeLessThan(withoutVix.KBOND);
    expect(data.metrics.find((m) => m.id === 'sovereignVol')?.name).not.toContain('MOVE');
  });
  it('rejects a missing ordinary business day after parsing an explicitly empty ECB observation', async () => {
    const rows = Array.from({ length: 45 }, (_, i) => new Date(Date.UTC(2026, 8, i + 10)))
      .filter((date) => date.getUTCDay() !== 0 && date.getUTCDay() !== 6)
      .map((date, i) => ({ date: date.toISOString().slice(0, 10), value: 2 + (i % 2 ? 0.1 : 0) }));
    const brokenCsv = csv(rows).replace('2026-10-14,2,', '2026-10-14,,').replace('2026-10-14,2.1,', '2026-10-14,,');
    const parsed = parseObservations(brokenCsv, 'ecb', now);
    expect(parsed.some((o) => o.date === '2026-10-14')).toBe(false);
    expect(() => realizedVolatility(parsed)).toThrow('Missing TARGET');
    const provider = createMarketProvider({ now: () => now, fetchFn: (async (url) => String(url) === MARKET_URLS.sovereign2y ? new Response(brokenCsv) : fetchFn(url)) as typeof fetch });
    const data = await provider();
    expect(data.metrics.find((m) => m.id === 'sovereignVol')?.value).toBeNull();
    expect(data.advice.outcome).toBe('Insufficient market data');
  });
  it('persists observations, marks failed refreshes as cache, recomputes staleness and excludes it from scoring', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'keystone-market-'));
    try {
      const cachePath = join(dir, 'market.json');
      await createMarketProvider({ cachePath, fetchFn, now: () => now })();
      expect(JSON.parse(await readFile(cachePath, 'utf8')).advice).toBeUndefined();
      const offline = vi.fn(async () => { throw new Error('offline'); }) as unknown as typeof fetch;
      const fallback = await createMarketProvider({ cachePath, fetchFn: offline, now: () => now })();
      expect(fallback.metrics.find((m) => m.id === 'vix')).toMatchObject({ value: '19.450000', delivery: 'cache', freshness: 'current', observedAt: '2026-10-23', retrievedAt: now.toISOString() });
      expect(fallback.advice.criteria.find((c) => c.id === 'valuation')?.metrics).toContain('vix');
      const data = await createMarketProvider({ cachePath, fetchFn: offline, now: () => new Date('2026-11-26T12:00:00Z') })();
      expect(data.metrics.find((m) => m.id === 'estr')).toMatchObject({ delivery: 'cache', freshness: 'stale', observedAt: '2026-10-22' });
      expect(data.advice.outcome).toBe('Insufficient market data');
      expect(data.metrics.find((m) => m.id === 'vix')).toMatchObject({ delivery: 'cache', freshness: 'stale', observedAt: '2026-10-23' });
      expect(data.advice.criteria).toHaveLength(0);
      // Previous Cboe CSV observations must never be relabelled as Yahoo.
      const old = (await createMarketProvider({ fetchFn, now: () => now })()).metrics.find((m) => m.id === 'vix')!;
      await writeFile(cachePath, JSON.stringify({ version: 1, metrics: [{ ...old, source: { ...old.source, url: 'https://www.cboe.com/tradable-products/vix/vix-historical-data/' } }] }));
      expect((await createMarketProvider({ cachePath, fetchFn: offline, now: () => now })()).metrics.find((m) => m.id === 'vix')?.value).toBeNull();
      // Untrusted cache cannot provide a different source URL or inject an old recommendation.
      await writeFile(cachePath, '{"version":1,"metrics":[{"id":"estr","value":"NaN"}]}');
      expect((await createMarketProvider({ cachePath, fetchFn: offline, now: () => now })()).metrics.every((m) => m.value === null)).toBe(true);
    } finally {
      if (dirname(resolve(dir)) !== resolve(tmpdir()) || !basename(dir).startsWith('keystone-market-')) throw new Error('Unexpected temporary path');
      await rm(dir, { recursive: true });
    }
  });
  it('handles HTTP failure, missing history, and timeout with no invented fallback', async () => {
    for (const fn of [async () => new Response('Unavailable', { status: 503 }), async () => new Response('TIME_PERIOD,OBS_VALUE\n'), async (_u: unknown, options?: RequestInit) => {
      await new Promise((_, reject) => options?.signal?.addEventListener('abort', () => reject(new Error('timeout')), { once: true }));
      return new Response('');
    }]) {
      const data = await createMarketProvider({ fetchFn: fn as typeof fetch, now: () => now, timeoutMs: 10 })();
      expect(data.advice.outcome).toBe('Insufficient market data');
      expect(data.metrics.every((m) => m.value === null)).toBe(true);
    }
  });
});

describe('Yahoo daily VIX closes', () => {
  it('selects the latest timestamp-aligned valid close, skips nulls/future points and ignores regularMarketPrice', () => {
    const data = yahoo(); const result = data.chart.result[0]!;
    result.timestamp = [unix('2026-10-23T07:00:00Z'), unix('2026-10-22T07:00:00Z'), unix('2026-10-27T07:00:00Z')];
    result.indicators.quote[0]!.close = [19.45, 19.03, 80];
    expect(parseYahooVix(data, now)).toEqual({ value: 19.45, date: '2026-10-23' });
    const missing = structuredClone(data) as unknown as { chart: { result: { indicators: { quote: { close: unknown[] }[] } }[] } };
    missing.chart.result[0]!.indicators.quote[0]!.close[0] = null;
    expect(parseYahooVix(missing, now)).toEqual({ value: 19.03, date: '2026-10-22' });
  });
  it('does not call a still-open daily bar a close; includes it at the exact session end', () => {
    const data = yahoo();
    expect(parseYahooVix(data, new Date('2026-10-23T19:00:00Z'))).toEqual({ value: 19.03, date: '2026-10-22' });
    expect(parseYahooVix(data, new Date('2026-10-23T20:15:00Z'))).toEqual({ value: 19.45, date: '2026-10-23' });
  });
  it('uses the exchange calendar date across UTC midnight', () => {
    const data = yahoo(); const result = data.chart.result[0]!;
    result.timestamp = [unix('2026-10-24T00:15:00Z')];
    result.indicators.quote[0]!.close = [19.45];
    expect(parseYahooVix(data, now)).toEqual({ value: 19.45, date: '2026-10-23' });
  });
  it('rejects errors, malformed charts, wrong ticker/granularity/timezone, nonfinite/negative closes and no completed bar', () => {
    const cases: unknown[] = [null, {}, { chart: { error: { code: 'Not Found' }, result: null } }];
    for (const mutate of [
      (d: ReturnType<typeof yahoo>) => { d.chart.result[0]!.meta.symbol = '^OTHER'; },
      (d: ReturnType<typeof yahoo>) => { d.chart.result[0]!.meta.dataGranularity = '1m'; },
      (d: ReturnType<typeof yahoo>) => { d.chart.result[0]!.meta.exchangeTimezoneName = 'invalid'; },
      (d: ReturnType<typeof yahoo>) => { d.chart.result[0]!.timestamp.pop(); },
      (d: ReturnType<typeof yahoo>) => { d.chart.result[0]!.indicators.quote[0]!.close = [NaN, -1]; },
      (d: ReturnType<typeof yahoo>) => { d.chart.result[0]!.meta.currentTradingPeriod.regular.end = 0; },
    ]) { const data = yahoo(); mutate(data); cases.push(data); }
    for (const data of cases) expect(() => parseYahooVix(data, now)).toThrow();
    expect(() => parseYahooVix(yahoo(), new Date('2026-10-22T06:00:00Z'))).toThrow();
  });
  it('keeps core advice available when only Yahoo fails or returns invalid JSON', async () => {
    for (const response of [new Response('rate limited', { status: 429 }), new Response('{bad json'), new Response(JSON.stringify({ chart: { error: { code: 'Unavailable' }, result: null } }))]) {
      const data = await createMarketProvider({ fetchFn: (async (url) => String(url) === MARKET_URLS.vix ? response : fetchFn(url)) as typeof fetch, now: () => now })();
      expect(data.metrics.find((m) => m.id === 'vix')).toMatchObject({ delivery: 'unavailable', value: null });
      expect(data.advice.scores).not.toBeNull();
      expect(data.advice.criteria.find((c) => c.id === 'valuation')?.metrics).not.toContain('vix');
    }
  });
});

function metrics(overrides: Partial<Record<MarketMetricId, number>> = {}): MarketMetric[] {
  const values = { sovereignVol: 3, euribor3m: 2, sovereign2y: 2, estr: 2, ...overrides };
  return unavailableMarket(now).metrics.map((m) => m.id === 'vix' ? m : { ...m, value: String(values[m.id]), observedAt: '2026-10-22', retrievedAt: now.toISOString(), freshness: 'current', delivery: 'source' });
}
describe('deterministic, symmetric class comparison', () => {
  it('supports all four outcomes; does not assume sovereign bonds always win or lose', () => {
    expect(scoreMarket(metrics()).outcome).toBe('No clear preference');
    expect(scoreMarket(metrics({ sovereign2y: 3 })).outcome).toBe('KBOND potentially preferable');
    expect(scoreMarket(metrics({ sovereignVol: 15 })).outcome).toBe('KMMF potentially preferable');
    expect(scoreMarket([]).outcome).toBe('Insufficient market data');
    expect(scoreMarket(metrics())).toEqual(scoreMarket(metrics()));
  });
  it('does not score stale or missing core data and has no token-price or haircut inputs', () => {
    const data = metrics(); data[1] = { ...data[1]!, freshness: 'stale' };
    expect(scoreMarket(data).scores).toBeNull();
    expect(scoreMarket(metrics()).criteria.find((c) => c.id === 'liquidity')).toMatchObject({ KMMF: 50, KBOND: 50 });
  });
  it('keeps VIX secondary, validates weights, allows custom weights', () => {
    const data = metrics(); data[0] = { ...data[0]!, value: '80', delivery: 'source', freshness: 'current' };
    const a = scoreMarket(metrics()).scores!; const b = scoreMarket(data).scores!;
    expect(Math.abs((a.KMMF - a.KBOND) - (b.KMMF - b.KBOND))).toBeLessThanOrEqual(0.5);
    expect(() => scoreMarket(data, { ...DEFAULT_WEIGHTS, duration: -1 })).toThrow();
    expect(() => scoreMarket(data, { ...DEFAULT_WEIGHTS, duration: Number.MAX_VALUE, yield: Number.MAX_VALUE })).toThrow();
    expect(() => scoreMarket(data, Object.fromEntries(Object.keys(DEFAULT_WEIGHTS).map((k) => [k, 0])) as AdvisorWeights)).toThrow();
    expect(scoreMarket(metrics({ sovereign2y: 3 }), { ...DEFAULT_WEIGHTS, yield: 100 }).outcome).toBe('KBOND potentially preferable');
  });
});

it('serves the advisor with no session, no mutations, preserved origin checks and a truthful provider failure', async () => {
  const k = makeKeeper(); const market = vi.fn(async () => unavailableMarket(now));
  const app = buildServer(config('keeper'), k.sessions, { market });
  try {
    const before = k.sessions.replay();
    const response = await app.inject({ method: 'GET', url: '/api/market-advisor' });
    expect(response.statusCode).toBe(200); expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json().advice.outcome).toBe('Insufficient market data');
    expect(k.sessions.replay()).toEqual(before); expect((await k.get('/session')).status).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/api/market-advisor', headers: { origin: 'https://evil.example' } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/api/market-advisor' })).statusCode).toBe(404);
    market.mockRejectedValueOnce(new Error('provider failed'));
    expect((await app.inject('/api/market-advisor')).json().advice.outcome).toBe('Insufficient market data');
  } finally { await app.close(); await k.app.close(); }
});
