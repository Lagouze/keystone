import { afterEach, describe, expect, it } from "vitest";
import type { ActivityEvent, SessionState } from "@keystone/shared";
import { computeMargin, collateralParams, fixedRateFromStart } from "../src/margin.ts";
import { makeKeeper, scenario } from "./helpers.ts";

type Keeper = ReturnType<typeof makeKeeper>;
let keeper: Keeper | null = null;
afterEach(async () => { await keeper?.app.close(); keeper = null; });
const start = (mode: "keeper" | "freighter" = "keeper") => (keeper = makeKeeper(mode));

const swap = { notionalEur: 10_000_000n, fixedRateMilli: fixedRateFromStart(2034), tenorYears: 5 };
const kmmf = collateralParams("0", "1000.00", "2.00");
const requiredAt = (bp: number) => computeMargin(swap, 2034 + bp * 10, kmmf).requiredUnits;

const feed = (k: Keeper): ActivityEvent[] => k.sessions.replay().flatMap((m) => (m.event === "activity" ? [m.data] : []));

describe("static routes", () => {
  it("GET /health and /config work without a session", async () => {
    const k = start();
    expect(await k.get("/health")).toEqual({ status: 200, body: { ok: true, network: "testnet" } });
    const cfg = await k.get("/config");
    expect(cfg.status).toBe(200);
    expect(cfg.body).toMatchObject({ network: "testnet", signerMode: "keeper", assets: [{ id: "KMMF", decimals: 7 }, { id: "KBOND" }] });
  });

  it("answers NoSession (404) on every session route, and NotFound on unknown routes", async () => {
    const k = start();
    for (const [method, url] of [["GET", "/session"], ["POST", "/session/settle-default"]] as const) {
      const r = method === "GET" ? await k.get(url) : await k.post(url);
      expect(r.status).toBe(404);
      expect(r.body.error.code).toBe("NoSession");
    }
    expect((await k.post("/session/rate-shock", { bp: -10 })).body.error.code).toBe("NoSession");
    expect((await k.post("/session/deposit", { units: "1" })).body.error.code).toBe("NoSession");
    expect((await k.get("/nope")).body.error.code).toBe("NotFound");
  });
});

describe("validation", () => {
  it("rejects bad bodies with BadRequest (400)", async () => {
    const k = start();
    expect((await k.post("/session", { asset: "BTC" })).status).toBe(400);
    expect((await k.post("/session")).status).toBe(400);
    await k.post("/session", { asset: "KMMF" });
    for (const units of ["0", "-5", "1.5", "007", 100, null, "1".repeat(40)]) {
      const r = await k.post("/session/deposit", { units });
      expect([r.status, r.body.error.code]).toEqual([400, "BadRequest"]);
    }
    for (const bp of [1.5, "10", null, 5000]) {
      expect((await k.post("/session/rate-shock", { bp })).status).toBe(400);
    }
    const malformed = await k.app.inject({ method: "POST", url: "/api/session/deposit", headers: { "content-type": "application/json" }, payload: "{not json" });
    expect(malformed.statusCode).toBe(400);
    expect(malformed.json().error.code).toBe("BadRequest");
  });
});

describe("signer modes", () => {
  it("SIGNER=freighter refuses the direct routes, SIGNER=keeper refuses prepare and submit", async () => {
    let k = start("freighter");
    await k.post("/session", { asset: "KMMF" });
    expect((await k.post("/session/deposit", { units: "1" })).body.error.code).toBe("SignerModeDisabled");
    expect((await k.post("/session/withdraw", { units: "1" })).status).toBe(409);
    await k.app.close();
    k = start("keeper");
    await k.post("/session", { asset: "KMMF" });
    for (const url of ["/session/deposit/prepare", "/session/withdraw/prepare"]) {
      expect((await k.post(url, { units: "1" })).body.error.code).toBe("SignerModeDisabled");
    }
    expect((await k.post("/session/submit", { signedTxXdr: "x" })).status).toBe(409);
  });

  it("freighter flow: prepare, then submit the signed transaction", async () => {
    const k = start("freighter");
    await k.post("/session", { asset: "KMMF" });
    const prep = await k.post("/session/deposit/prepare", { units: "500" });
    expect(prep.status).toBe(200);
    const done = await k.post("/session/submit", { signedTxXdr: prep.body.txXdr });
    expect(done.status).toBe(200);
    expect(done.body.vault.availableUnits).toBe("500");
    expect((await k.post("/session/submit", { signedTxXdr: "garbage" })).status).toBe(400);
  });
});

describe("scenario 1: margin and release (KMMF)", () => {
  it("runs deposit, shocks, top-up, release and withdrawal", async () => {
    const k = start();
    const created = await k.post("/session", { asset: "KMMF" });
    expect(created.status).toBe(200);
    expect(created.body).toMatchObject({
      asset: "KMMF",
      swap: { notionalEur: "10000000.00", fixedRatePct: "2.030", floatRatePct: "2.034", floatRateSource: "ecb", tenorYears: 5 },
      vault: { status: "active", epoch: 0, callDeadline: null, availableUnits: "0" },
    });

    const dep = await k.post("/session/deposit", { units: "3000000000" });
    expect(dep.body.vault.availableUnits).toBe("3000000000");
    expect(dep.body.balances.fundUnits).toBe("7000000000");

    const s1: SessionState = (await k.post("/session/rate-shock", { bp: -50 })).body;
    expect(s1.swap).toMatchObject({ floatRatePct: "1.534", floatRateSource: "scenario" });
    expect(s1.vault).toMatchObject({ status: "active", epoch: 1, lockedUnits: requiredAt(-50).toString(), shortfallUnits: "0" });
    expect(s1.margin).toMatchObject({ mtmFundEur: "-238288.43", requiredValueEur: "238288.43", requiredUnits: "2431514592" });

    const s2: SessionState = (await k.post("/session/rate-shock", { bp: -30 })).body;
    expect(s2.swap.floatRatePct).toBe("1.234");
    expect(s2.vault.status).toBe("margin_call");
    expect(s2.vault.epoch).toBe(2);
    expect(s2.vault.requiredUnits).toBe("3932595511");
    expect(s2.vault.shortfallUnits).toBe((requiredAt(-80) - 3_000_000_000n).toString());
    expect(s2.vault.callDeadline).toBe(new Date((1_800_000_000 + 90) * 1000).toISOString());

    const cured: SessionState = (await k.post("/session/deposit", { units: "1000000000" })).body;
    expect(cured.vault).toMatchObject({ status: "active", shortfallUnits: "0", callDeadline: null });

    const s3: SessionState = (await k.post("/session/rate-shock", { bp: 60 })).body;
    expect(s3.swap.floatRatePct).toBe("1.834");
    expect(BigInt(s3.vault.lockedUnits)).toBeLessThan(BigInt(s2.vault.requiredUnits));
    const released = BigInt(s3.vault.availableUnits);
    expect(released).toBeGreaterThan(0n);

    const w: SessionState = (await k.post("/session/withdraw", { units: released.toString() })).body;
    expect(w.vault.availableUnits).toBe("0");
    expect(BigInt(w.balances.fundUnits)).toBe(10_000_000_000n - BigInt(w.vault.lockedUnits));
    // available + locked = what the fund put in, minus what it took out
    expect(BigInt(w.vault.lockedUnits)).toBe(BigInt(s3.vault.lockedUnits));

    const types = feed(k).filter((e) => e.status === "confirmed").map((e) => `${e.kind}:${e.type}`);
    expect(types).toEqual([
      "chain:session_started", "chain:deposit",
      "sim:rate_shock", "chain:margin_set",
      "sim:rate_shock", "chain:margin_set", "chain:margin_call",
      "chain:deposit", "chain:cured",
      "sim:rate_shock", "chain:margin_set", "chain:released",
      "chain:withdraw",
    ]);
  });

  it("every confirmed chain entry carries a hash and link, and sim entries never do", async () => {
    const k = start();
    await k.post("/session", { asset: "KMMF" });
    await k.post("/session/deposit", { units: "3000000000" });
    await k.post("/session/rate-shock", { bp: -50 });
    for (const e of feed(k)) {
      if (e.kind === "chain") {
        expect(e.status).toBe("confirmed");
        expect(e.txHash).toMatch(/^FAKE[0-9a-f]{60}$/);
        expect(e.explorerUrl).toBe(`https://stellar.expert/explorer/testnet/tx/${e.txHash}`);
      } else {
        expect(e.txHash).toBeUndefined();
        expect(e.explorerUrl).toBeUndefined();
      }
    }
    const shock = feed(k).filter((e) => e.type === "rate_shock" || e.type === "margin_set");
    expect(shock).toHaveLength(2);
  });

  it("a failed transaction leaves a failed entry and the vault unchanged", async () => {
    const k = start();
    await k.post("/session", { asset: "KMMF" });
    const r = await k.post("/session/withdraw", { units: "1" });
    expect([r.status, r.body.error.code]).toEqual([409, "InsufficientAvailable"]);
    const last = feed(k).at(-1)!;
    expect(last).toMatchObject({ type: "withdraw", status: "failed" });
    expect(last.txHash).toBeUndefined();
    expect((await k.get("/session")).body.vault.availableUnits).toBe("0");
  });
});

describe("MTA rule", () => {
  it("a shock below the MTA adds only a sim entry and sends no transaction", async () => {
    const k = start();
    await k.post("/session", { asset: "KMMF" });
    const r = await k.post("/session/rate-shock", { bp: -1 });
    expect(r.status).toBe(200);
    expect(r.body.vault.epoch).toBe(0);
    expect(r.body.margin.requiredValueEur).not.toBe("0.00");
    expect(BigInt(r.body.margin.requiredUnits)).toBeGreaterThan(0n);
    expect(r.body.vault.requiredUnits).toBe("0"); // computed requirement differs from the posted one
    expect(feed(k).map((e) => `${e.kind}:${e.type}`)).toEqual(["chain:session_started", "sim:rate_shock"]);
  });

  it("measures the move from the last posted value, not from the previous shock", async () => {
    const k = start();
    await k.post("/session", { asset: "KMMF" });
    await k.post("/session/deposit", { units: "3000000000" });
    await k.post("/session/rate-shock", { bp: -50 });  // posts, epoch 1
    const r = await k.post("/session/rate-shock", { bp: -1 });  // about 4 000 EUR more: below the MTA
    expect(r.body.vault.epoch).toBe(1);
    expect(r.body.vault.requiredUnits).toBe(requiredAt(-50).toString());
    expect(BigInt(r.body.margin.requiredUnits)).toBeGreaterThan(requiredAt(-50));
  });
});

describe("scenario 2: default (KBOND)", () => {
  it("refuses settlement during the grace period, then transfers the collateral to the bank", async () => {
    const k = start();
    await k.post("/session", { asset: "KBOND" });
    await k.post("/session/deposit", { units: "3000000000" });
    const call: SessionState = (await k.post("/session/rate-shock", { bp: -100 })).body;
    expect(call.vault.status).toBe("margin_call");
    expect(call.vault.lockedUnits).toBe("3000000000");

    const early = await k.post("/session/settle-default");
    expect([early.status, early.body.error.code]).toEqual([409, "GracePeriodRunning"]);

    k.clock.seconds += 90n;
    const done = await k.post("/session/settle-default");
    expect(done.status).toBe(200);
    expect(done.body.vault).toMatchObject({ status: "defaulted", lockedUnits: "0", requiredUnits: "0", shortfallUnits: "0", callDeadline: null });
    expect(done.body.balances).toEqual({ fundUnits: "7000000000", bankUnits: "3000000000" });
    const attempts = feed(k).filter((e) => e.type === "defaulted");
    expect(attempts.map((e) => e.status)).toEqual(["failed", "confirmed"]);
    const defaulted = attempts[1]!;
    expect(defaulted).toMatchObject({ kind: "chain", status: "confirmed" });
    expect(defaulted.txHash).toBeDefined();
  });

  it("freezes the margin after a default: rate-shock answers Defaulted (409) and changes nothing", async () => {
    const k = start();
    await k.post("/session", { asset: "KBOND" });
    await k.post("/session/deposit", { units: "3000000000" });
    await k.post("/session/rate-shock", { bp: -100 });
    k.clock.seconds += 90n;
    const before: SessionState = (await k.post("/session/settle-default")).body;
    const entries = feed(k).length;

    const r = await k.post("/session/rate-shock", { bp: 50 });
    expect([r.status, r.body.error.code]).toEqual([409, "Defaulted"]);
    const after: SessionState = (await k.get("/session")).body;
    expect(after.margin).toEqual(before.margin);
    expect(after.swap).toEqual(before.swap);
    expect(after.margin.requiredUnits).toBe(requiredAt(-100).toString());
    expect(after.vault.requiredUnits).toBe("0");
    expect(feed(k)).toHaveLength(entries);
  });
});

describe("sessions", () => {
  it("POST /session replaces the session and clears the history", async () => {
    const k = start();
    const a = (await k.post("/session", { asset: "KMMF" })).body as SessionState;
    await k.post("/session/deposit", { units: "100" });
    const b = (await k.post("/session", { asset: "KBOND" })).body as SessionState;
    expect(b.sessionId).not.toBe(a.sessionId);
    expect(b.vaultId).not.toBe(a.vaultId);
    expect(b.vault.availableUnits).toBe("0");
    const entries = feed(k);
    expect(entries.map((e) => e.type)).toEqual(["session_started"]);
    expect(entries.every((e) => e.sessionId === b.sessionId)).toBe(true);
  });

  it("runs concurrent writes one after the other", async () => {
    const k = start();
    await k.post("/session", { asset: "KMMF" });
    const results = await Promise.all([1, 2, 3, 4].map(() => k.post("/session/deposit", { units: "10" })));
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect((await k.get("/session")).body.vault.availableUnits).toBe("40");
  });
});

describe("GET /events (SSE)", () => {
  async function readEvents(url: string, count: number, onOpen?: () => Promise<void>) {
    const res = await fetch(url);
    expect(res.headers.get("content-type")).toBe("text/event-stream");
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const events: { event: string; data: any }[] = [];
    let opened = false;
    while (events.length < count) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (!opened && onOpen) { opened = true; await onOpen(); }
      let i: number;
      while ((i = buffer.indexOf("\n\n")) >= 0) {
        const block = buffer.slice(0, i);
        buffer = buffer.slice(i + 2);
        const ev = /^event: (.+)$/m.exec(block)?.[1];
        const data = /^data: (.+)$/m.exec(block)?.[1];
        if (ev && data) events.push({ event: ev, data: JSON.parse(data) });
      }
    }
    await reader.cancel();
    return events;
  }

  it("replays the history then the state, then streams live updates", async () => {
    const k = start();
    await k.post("/session", { asset: "KMMF" });
    await k.post("/session/deposit", { units: "100" });
    await k.app.listen({ port: 0, host: "127.0.0.1" });
    const addr = k.app.server.address() as { port: number };
    const events = await readEvents(`http://127.0.0.1:${addr.port}/api/events`, 6, async () => {
      await k.post("/session/deposit", { units: "5" });
    });
    expect(events.map((e) => e.event)).toEqual(["activity", "activity", "state", "activity", "activity", "state"]);
    expect(events.slice(3, 5).map((e) => e.data.status)).toEqual(["pending", "confirmed"]);
    expect(events[5]!.data.vault.availableUnits).toBe("105");
    expect(events[0]!.data).toMatchObject({ type: "session_started", status: "confirmed" });
    expect(events[2]!.data.vault.availableUnits).toBe("100");
  });

  it("updates a pending entry in place with the same id", async () => {
    const k = start();
    await k.post("/session", { asset: "KMMF" });
    const seen: ActivityEvent[] = [];
    k.sessions.subscribe((m) => { if (m.event === "activity") seen.push({ ...m.data }); });
    await k.post("/session/deposit", { units: "100" });
    const deposits = seen.filter((e) => e.type === "deposit");
    expect(deposits.map((e) => e.status)).toEqual(["pending", "confirmed"]);
    expect(deposits[0]!.id).toBe(deposits[1]!.id);
    expect(deposits[0]!.txHash).toBeUndefined();
  });

  it("closes open streams when the server stops", async () => {
    const k = start();
    await k.app.listen({ port: 0, host: "127.0.0.1" });
    const addr = k.app.server.address() as { port: number };
    const res = await fetch(`http://127.0.0.1:${addr.port}/api/events`);
    await res.body!.getReader().read();
    await k.app.close();
    keeper = null;
  });
});

describe("scenario file", () => {
  it("describes the two planned scenarios", () => {
    expect(scenario.scenarios.map((s) => [s.id, s.asset])).toEqual([["margin-and-release", "KMMF"], ["default", "KBOND"]]);
  });
});
