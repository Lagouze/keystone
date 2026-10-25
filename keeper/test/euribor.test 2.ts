import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getEuribor, parseEcbCsv } from "../src/euribor.ts";
import { formatMilli, parseMilli } from "../src/amounts.ts";

const CSV = [
  "KEY,FREQ,TIME_PERIOD,OBS_VALUE,OBS_STATUS,TITLE",
  'FM.M.U2.EUR.RT.MM.EURIBOR3MD_.HSTA,M,2026-09,2.6350455,A,"Euribor 3-month, historical close"',
].join("\n");

const fixedNow = () => new Date("2026-10-25T20:00:00.000Z");
const okFetch = (async () => new Response(CSV, { status: 200 })) as typeof fetch;
const failingFetch = (async () => { throw new Error("network down"); }) as typeof fetch;

describe("parseEcbCsv", () => {
  it("reads the last observation by header name, with quoted fields", () => {
    expect(parseEcbCsv(CSV)).toEqual({ period: "2026-09", rateMilli: 2635 });
  });
  it("rejects an empty answer", () => {
    expect(() => parseEcbCsv("KEY,TIME_PERIOD,OBS_VALUE")).toThrow();
  });
});

describe("rate formatting", () => {
  it("round-trips thousandths of a percent", () => {
    expect(formatMilli(2034)).toBe("2.034");
    expect(formatMilli(-250)).toBe("-0.250");
    expect(formatMilli(5)).toBe("0.005");
    expect(parseMilli("2.0345")).toBe(2035);
    expect(parseMilli("-0.4")).toBe(-400);
  });
});

describe("getEuribor", () => {
  const dir = mkdtempSync(join(tmpdir(), "euribor-"));

  it("returns the ECB value, source ecb, and writes the cache", async () => {
    const cachePath = join(dir, "a", "cache.json");
    const r = await getEuribor({ fetchFn: okFetch, cachePath, now: fixedNow });
    expect(r).toMatchObject({ source: "ecb", period: "2026-09", rateMilli: 2635 });
    expect(JSON.parse(readFileSync(cachePath, "utf8"))).toEqual({
      period: "2026-09", rateMilli: 2635, fetchedAt: "2026-10-25T20:00:00.000Z",
    });
  });

  it("leaves the cache file untouched when the observation did not change", async () => {
    const cachePath = join(dir, "same.json");
    const seed = JSON.stringify({ period: "2026-09", rateMilli: 2635, fetchedAt: "2026-09-30T00:00:00.000Z" });
    writeFileSync(cachePath, seed);
    await getEuribor({ fetchFn: okFetch, cachePath, now: fixedNow });
    expect(readFileSync(cachePath, "utf8")).toBe(seed);
  });

  it("falls back to the cache, source cache, when the ECB fails", async () => {
    const cachePath = join(dir, "b.json");
    writeFileSync(cachePath, JSON.stringify({ period: "2026-08", rateMilli: 2500, fetchedAt: "2026-09-01T00:00:00.000Z" }));
    const r = await getEuribor({ fetchFn: failingFetch, cachePath });
    expect(r).toMatchObject({ source: "cache", period: "2026-08", rateMilli: 2500 });
  });

  it("falls back to the cache on an HTTP error", async () => {
    const cachePath = join(dir, "c.json");
    writeFileSync(cachePath, JSON.stringify({ period: "2026-08", rateMilli: 2500, fetchedAt: "x" }));
    const r = await getEuribor({ fetchFn: (async () => new Response("", { status: 503 })) as typeof fetch, cachePath });
    expect(r.source).toBe("cache");
  });

  it("fails clearly with neither the ECB nor a cache", async () => {
    await expect(getEuribor({ fetchFn: failingFetch, cachePath: join(dir, "missing.json") })).rejects.toThrow(/no cache/);
  });

  it("ignores a corrupt cache", async () => {
    const cachePath = join(dir, "d.json");
    writeFileSync(cachePath, "{not json");
    await expect(getEuribor({ fetchFn: failingFetch, cachePath })).rejects.toThrow(/no cache/);
  });
});
