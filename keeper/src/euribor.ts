// Starting float rate: last observation of the ECB series FM.M.U2.EUR.RT.MM.EURIBOR3MD_.HSTA,
// cached on disk so the demo survives an ECB outage.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseMilli } from "./amounts.ts";

export const ECB_URL =
  "https://data-api.ecb.europa.eu/service/data/FM/M.U2.EUR.RT.MM.EURIBOR3MD_.HSTA?lastNObservations=1&format=csvdata";

export interface EuriborObservation {
  period: string;      // "2026-09"
  rateMilli: number;   // thousandths of a percent: 2.635 % = 2635
  fetchedAt: string;   // ISO 8601, when the keeper read it from the ECB
}

export interface EuriborResult extends EuriborObservation {
  source: "ecb" | "cache";
}

/** Reads TIME_PERIOD and OBS_VALUE from the ECB CSV, by header name. */
export function parseEcbCsv(csv: string): { period: string; rateMilli: number } {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error("ECB response has no observation");
  const header = splitCsv(lines[0]!);
  const row = splitCsv(lines[lines.length - 1]!);
  const period = row[header.indexOf("TIME_PERIOD")];
  const value = row[header.indexOf("OBS_VALUE")];
  if (!period || !value) throw new Error("ECB response misses TIME_PERIOD or OBS_VALUE");
  return { period, rateMilli: parseMilli(value) };
}

function splitCsv(line: string): string[] {
  const out: string[] = [];
  const re = /("([^"]*)"|[^,]*)(,|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    out.push(m[2] ?? m[1]!);
    if (m[3] === "") break;
  }
  return out;
}

export interface EuriborDeps {
  fetchFn?: typeof fetch;
  cachePath: string;
  now?: () => Date;
  timeoutMs?: number;
}

export async function getEuribor(deps: EuriborDeps): Promise<EuriborResult> {
  const fetchFn = deps.fetchFn ?? fetch;
  const now = deps.now ?? (() => new Date());
  try {
    const res = await fetchFn(ECB_URL, {
      headers: { Accept: "text/csv" },
      signal: AbortSignal.timeout(deps.timeoutMs ?? 8000),
    });
    if (!res.ok) throw new Error(`ECB answered HTTP ${res.status}`);
    const observation: EuriborObservation = { ...parseEcbCsv(await res.text()), fetchedAt: now().toISOString() };
    try {
      // The cache is versioned as a seed: rewrite it only when the observation changed.
      const known = readCache(deps.cachePath);
      if (known?.period !== observation.period || known.rateMilli !== observation.rateMilli) {
        mkdirSync(dirname(deps.cachePath), { recursive: true });
        writeFileSync(deps.cachePath, `${JSON.stringify(observation, null, 2)}\n`);
      }
    } catch {
      // A read-only disk must not stop a live observation from being used.
    }
    return { ...observation, source: "ecb" };
  } catch (cause) {
    const cached = readCache(deps.cachePath);
    if (!cached) throw new Error(`Euribor unavailable and no cache: ${(cause as Error).message}`);
    return { ...cached, source: "cache" };
  }
}

function readCache(path: string): EuriborObservation | null {
  try {
    const v = JSON.parse(readFileSync(path, "utf8")) as Partial<EuriborObservation>;
    if (typeof v.period === "string" && Number.isInteger(v.rateMilli) && typeof v.fetchedAt === "string") {
      return v as EuriborObservation;
    }
  } catch {
    // missing or unreadable cache
  }
  return null;
}
