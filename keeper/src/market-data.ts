import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { AdvisorWeights, MarketMetric, MarketMetricId, MarketSnapshot } from '@keystone/shared';
import { ECB_URL, parseEcbCsv } from './euribor.ts';
import { scoreMarket } from './market-scoring.ts';

const DAY = 86_400_000;
export const MARKET_URLS = {
  vix: 'https://cdn-api.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv',
  sovereign2y: 'https://data-api.ecb.europa.eu/service/data/YC/B.U2.EUR.4F.G_N_A.SV_C_YM.SR_2Y?lastNObservations=30&format=csvdata',
  euribor3m: ECB_URL,
  estr: 'https://data-api.ecb.europa.eu/service/data/EST/B.EU000A2X2A25.WT?lastNObservations=1&format=csvdata',
};
const meta: Record<MarketMetricId, Pick<MarketMetric, 'name' | 'unit' | 'source' | 'frequency' | 'note'>> = {
  vix: { name: 'VIX', unit: 'index points', frequency: 'daily close', source: { name: 'Cboe', url: 'https://www.cboe.com/tradable-products/vix/vix-historical-data/', series: 'VIX daily close' }, note: 'US equity implied volatility; secondary stress context only.' },
  sovereignVol: { name: 'Euro sovereign realized yield volatility (20 changes)', unit: 'bp/day', frequency: 'daily', source: { name: 'ECB / Keystone calculation', url: 'https://data.ecb.europa.eu/data/datasets/YC/YC.B.U2.EUR.4F.G_N_A.SV_C_YM.SR_2Y', series: 'YC.B.U2.EUR.4F.G_N_A.SV_C_YM.SR_2Y' }, note: 'Sample standard deviation of the last 20 daily yield changes × 100. Not MOVE; not annualized or a price volatility.' },
  euribor3m: { name: 'Euribor 3M (monthly average)', unit: '% p.a.', frequency: 'monthly average', source: { name: 'ECB, underlying Refinitiv / EMMI series', url: 'https://data.ecb.europa.eu/data/datasets/FM/FM.M.U2.EUR.RT.MM.EURIBOR3MD_.HSTA', series: 'FM.M.U2.EUR.RT.MM.EURIBOR3MD_.HSTA' }, note: 'Last published monthly average, not today’s fixing. Reuses the keeper’s ECB series and parser without changing margin inputs.' },
  sovereign2y: { name: 'Euro sovereign 2Y AAA spot yield', unit: '% p.a.', frequency: 'daily', source: { name: 'ECB', url: 'https://data.ecb.europa.eu/data/datasets/YC/YC.B.U2.EUR.4F.G_N_A.SV_C_YM.SR_2Y', series: 'YC.B.U2.EUR.4F.G_N_A.SV_C_YM.SR_2Y' }, note: 'Fitted AAA sovereign spot curve; continuous compounding. Not a specific bond or the KBOND token yield.' },
  estr: { name: '€STR overnight', unit: '% p.a.', frequency: 'daily', source: { name: 'ECB', url: 'https://data.ecb.europa.eu/data/datasets/EST/EST.B.EU000A2X2A25.WT', series: 'EST.B.EU000A2X2A25.WT' }, note: 'Published overnight benchmark, not an intraday quote.' },
};

export interface Observation { date: string; value: number }
function csvRows(csv: string): string[][] {
  // SDMX descriptions contain quoted commas and escaped quotes.
  return csv.replace(/^\uFEFF/, '').trim().split(/\r?\n/).map((line) => {
    const fields: string[] = []; let text = ''; let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i]!;
      if (c === '"') { if (quoted && line[i + 1] === '"') { text += '"'; i++; } else quoted = !quoted; }
      else if (c === ',' && !quoted) { fields.push(text); text = ''; } else text += c;
    }
    if (quoted) throw new Error('Malformed CSV');
    fields.push(text); return fields;
  });
}
function validDay(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
}
export function parseObservations(csv: string, kind: 'ecb' | 'vix', now: Date): Observation[] {
  const [header, ...rows] = csvRows(csv);
  const di = header?.indexOf(kind === 'ecb' ? 'TIME_PERIOD' : 'DATE') ?? -1;
  const vi = header?.indexOf(kind === 'ecb' ? 'OBS_VALUE' : 'CLOSE') ?? -1;
  if (di < 0 || vi < 0) throw new Error('Missing market CSV columns');
  const observations = rows.flatMap((r) => {
    const rawDate = r[di] ?? ''; const text = r[vi]?.trim() ?? '';
    const date = kind === 'vix' ? rawDate.replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, '$3-$1-$2') : rawDate;
    const value = Number(text);
    if (!text || !Number.isFinite(value) || !validDay(date) || date > now.toISOString().slice(0, 10)) return [];
    if (kind === 'vix' && value < 0) return [];
    return [{ date, value }];
  }).sort((a, b) => a.date.localeCompare(b.date));
  if (!observations.length || new Set(observations.map((o) => o.date)).size !== observations.length) throw new Error('No valid observations or duplicate dates');
  return observations;
}
export function realizedVolatility(observations: Observation[]): { value: number; start: string; end: string; observations: number } {
  if (observations.length < 21) throw new Error('Need 21 daily observations for 20 changes');
  const sample = observations.slice(-21);
  // Missing weeks must not masquerade as daily changes (weekends/holidays up to four days allowed).
  if (sample.some((o, i) => i > 0 && (Date.parse(o.date) - Date.parse(sample[i - 1]!.date)) / DAY > 4)) throw new Error('Gaps in daily history');
  const changes = sample.slice(1).map((o, i) => (o.value - sample[i]!.value) * 100);
  const mean = changes.reduce((s, x) => s + x, 0) / changes.length;
  return { value: Math.sqrt(changes.reduce((s, x) => s + (x - mean) ** 2, 0) / (changes.length - 1)), start: sample[0]!.date, end: sample.at(-1)!.date, observations: sample.length };
}
function fresh(id: MarketMetricId, date: string | null, now: Date): MarketMetric['freshness'] {
  if (!date) return 'unknown';
  let end = date;
  if (id === 'euribor3m') {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(date)) return 'unknown';
    end = new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0)).toISOString().slice(0, 10);
  }
  if (!validDay(end) || end > now.toISOString().slice(0, 10)) return 'unknown';
  return now.getTime() - Date.parse(end) <= (id === 'euribor3m' ? 45 : 7) * DAY ? 'current' : 'stale';
}
export function unavailableMarket(now = new Date()): MarketSnapshot {
  const metrics = (Object.keys(meta) as MarketMetricId[]).map((id): MarketMetric => ({ id, ...meta[id], value: null, observedAt: null, retrievedAt: null, delivery: 'unavailable', freshness: 'unknown', note: `${meta[id].note} Market provider unavailable.` }));
  return { asOf: now.toISOString(), metrics, advice: scoreMarket(metrics) };
}

export function createMarketProvider(options: {
  cachePath?: string; fetchFn?: typeof fetch; now?: () => Date; timeoutMs?: number; refreshMs?: number;
  /** Enable only with permission for the intended Cboe data use. Never bypasses access restrictions. */
  vixEnabled?: boolean; weights?: AdvisorWeights;
} = {}): () => Promise<MarketSnapshot> {
  const fetchFn = options.fetchFn ?? fetch;
  const now = options.now ?? (() => new Date());
  let lastAttempt = -Infinity;
  const cached = new Map<MarketMetricId, MarketMetric>();
  let loaded = false;
  let pending: Promise<MarketSnapshot> | null = null;
  async function download(url: string) {
    const response = await fetchFn(url, { headers: { Accept: 'text/csv' }, signal: AbortSignal.timeout(options.timeoutMs ?? 6000) });
    if (!response.ok) throw new Error(`Market source HTTP ${response.status}`);
    const text = await response.text();
    if (text.length > 2_000_000) throw new Error('Market response too large');
    return text;
  }
  const render = (date: Date, reused: boolean): MarketSnapshot => {
    const metrics = (Object.keys(meta) as MarketMetricId[]).map((id): MarketMetric => {
      if (id === 'vix' && !options.vixEnabled) return { id, ...meta[id], value: null, observedAt: null, retrievedAt: null, freshness: 'unknown', delivery: 'restricted', note: 'Cboe reuse permission is not configured. VIX is excluded from scoring; open the source for context.' };
      const m = cached.get(id);
      if (!m) return { id, ...meta[id], value: null, observedAt: null, retrievedAt: null, freshness: 'unknown', delivery: 'unavailable', note: `${meta[id].note} Source unavailable or invalid; no substitute value.` };
      return { ...m, freshness: fresh(id, m.observedAt, date), delivery: reused || m.delivery === 'cache' ? 'cache' : 'source' };
    });
    return { asOf: date.toISOString(), metrics, advice: scoreMarket(metrics, options.weights) };
  };
  async function update(): Promise<MarketSnapshot> {
    const date = now();
    if (!loaded) {
      loaded = true;
      if (options.cachePath) try {
        const data = JSON.parse(await readFile(options.cachePath, 'utf8')) as { version?: number; metrics?: MarketMetric[] };
        if (data.version === 1 && Array.isArray(data.metrics)) for (const m of data.metrics) {
          if (m && Object.hasOwn(meta, m.id) && typeof m.value === 'string' && m.value.trim() && Number.isFinite(Number(m.value)) && typeof m.observedAt === 'string'
            && typeof m.retrievedAt === 'string' && Number.isFinite(Date.parse(m.retrievedAt)) && Date.parse(m.retrievedAt) <= date.getTime() && fresh(m.id, m.observedAt, date) !== 'unknown'
            && (m.id !== 'sovereignVol' || (Number(m.value) >= 0 && m.calculation?.observations === 21))) {
            cached.set(m.id, { ...m, ...meta[m.id], delivery: 'cache' });
          }
        }
      } catch { /* No cache is a normal first run. */ }
    }
    if (date.getTime() - lastAttempt < (options.refreshMs ?? 3_600_000)) return render(date, true);
    lastAttempt = date.getTime();
    for (const [id, metric] of cached) cached.set(id, { ...metric, delivery: 'cache' });
    const set = (id: MarketMetricId, value: number, observedAt: string, calculation?: MarketMetric['calculation']) => {
      if (!Number.isFinite(value) || fresh(id, observedAt, date) === 'unknown') throw new Error('Invalid market observation');
      cached.set(id, { id, ...meta[id], value: value.toFixed(id === 'sovereignVol' ? 4 : 6), observedAt, retrievedAt: date.toISOString(), freshness: fresh(id, observedAt, date), delivery: 'source', ...(calculation ? { calculation } : {}) });
    };
    await Promise.allSettled([
      (async () => { const r = parseEcbCsv(await download(MARKET_URLS.euribor3m)); set('euribor3m', r.rateMilli / 1000, r.period); })(),
      (async () => { const rows = parseObservations(await download(MARKET_URLS.estr), 'ecb', date); const r = rows.at(-1)!; set('estr', r.value, r.date); })(),
      (async () => { const rows = parseObservations(await download(MARKET_URLS.sovereign2y), 'ecb', date); const r = rows.at(-1)!; set('sovereign2y', r.value, r.date); const vol = realizedVolatility(rows); set('sovereignVol', vol.value, vol.end, { method: 'Sample SD of 20 daily yield changes × 100 (bp/day), not annualized', start: vol.start, end: vol.end, observations: vol.observations }); })(),
      ...(options.vixEnabled ? [(async () => { const rows = parseObservations(await download(MARKET_URLS.vix), 'vix', date); const r = rows.at(-1)!; set('vix', r.value, r.date); })()] : []),
    ]);
    if (options.cachePath) try {
      await mkdir(dirname(options.cachePath), { recursive: true });
      // Cache observations, never an advice result: scoring and freshness are recomputed on each read.
      await writeFile(options.cachePath, JSON.stringify({ version: 1, metrics: [...cached.values()] }, null, 2) + '\n');
    } catch { /* Read-only disk must not break the advisor. */ }
    return render(date, false);
  }
  return () => { pending ??= update().finally(() => { pending = null; }); return pending; };
}
