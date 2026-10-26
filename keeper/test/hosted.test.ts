import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { makeAuthorizer, originMatcher, parseAccessTokens } from "../src/access.ts";
import { KeeperError } from "../src/errors.ts";
import { FakeVaultClient } from "../src/fake-vault-client.ts";
import { buildServer } from "../src/server.ts";
import { SessionManager } from "../src/session.ts";
import { SessionStore } from "../src/store.ts";
import type { TxResult } from "../src/vault-client.ts";
import { config, scenario } from "./helpers.ts";

const TOKEN = "t".repeat(40);
const WEB = "https://keystone-web.vercel.app";
const euribor = async () => ({ period: "2026-09", rateMilli: 2034, fetchedAt: "2026-10-25T00:00:00.000Z", source: "ecb" as const });

describe("access codes", () => {
  it("refuses short tokens and accepts a list", () => {
    expect(() => parseAccessTokens("short")).toThrow(/at least 32/);
    expect(parseAccessTokens(` ${TOKEN} , ${"u".repeat(32)} `)).toHaveLength(2);
    expect(parseAccessTokens(undefined)).toEqual([]);
  });

  it("checks the bearer header against every token", () => {
    const ok = makeAuthorizer([TOKEN, "u".repeat(32)]);
    expect(ok(`Bearer ${TOKEN}`)).toBe(true);
    expect(ok(`Bearer ${"u".repeat(32)}`)).toBe(true);
    expect(ok(`Bearer ${TOKEN}x`)).toBe(false);
    expect(ok(TOKEN)).toBe(false);
    expect(ok(undefined)).toBe(false);
    expect(makeAuthorizer([])("Bearer x")).toBe(false);
  });

  it("matches exact origins and single-label wildcards only", () => {
    const m = originMatcher([WEB, "https://keystone-*-team.vercel.app"]);
    expect(m(WEB)).toBe(true);
    expect(m("https://keystone-abc123-team.vercel.app")).toBe(true);
    expect(m("https://keystone-a.b-team.vercel.app")).toBe(false);
    expect(m("https://keystone-abc-team.vercel.app.evil.com")).toBe(false);
    expect(m("http://keystone-web.vercel.app")).toBe(false);
  });
});

describe("hosted API", () => {
  const make = () => {
    const client = new FakeVaultClient();
    const sessions = new SessionManager({ client, config: config("freighter"), scenario, euribor });
    const app = buildServer(config("freighter"), sessions, {
      accessTokens: [TOKEN], backend: "testnet",
      allowedOrigin: (o) => o === WEB, allowedHost: (h) => h === "keeper.example.com",
    });
    const call = (method: "GET" | "POST" | "OPTIONS", url: string, headers: Record<string, string> = {}, payload?: object) =>
      app.inject({ method, url: `/api${url}`, headers: { host: "keeper.example.com", origin: WEB, ...headers }, payload });
    return { app, call };
  };

  it("lets anyone read but nobody write without the code", async () => {
    const { call } = make();
    expect((await call("GET", "/health")).statusCode).toBe(200);
    const cfg = (await call("GET", "/config")).json();
    expect(cfg).toMatchObject({ backend: "testnet", writeAuth: "token", signerMode: "freighter" });
    for (const [url, body] of [
      ["/session", { asset: "KMMF" }], ["/session/rate-shock", { bp: 10 }], ["/session/settle-default", {}],
      ["/session/deposit/prepare", { units: "1" }], ["/session/withdraw/prepare", { units: "1" }],
      ["/session/submit", { signedTxXdr: "x" }], ["/session/deposit", { units: "1" }], ["/session/withdraw", { units: "1" }],
    ] as const) {
      const none = await call("POST", url, {}, body);
      expect(none.statusCode, url).toBe(401);
      expect(none.json().error.code).toBe("Unauthorized");
      expect((await call("POST", url, { authorization: "Bearer wrong" }, body)).statusCode, url).toBe(401);
    }
  });

  it("answers 401 with CORS headers so the page can read it, and serves preflights without a code", async () => {
    const { call } = make();
    const denied = await call("POST", "/session", {}, { asset: "KMMF" });
    expect(denied.headers["access-control-allow-origin"]).toBe(WEB);
    const pre = await call("OPTIONS", "/session", { "access-control-request-method": "POST", "access-control-request-headers": "authorization,content-type" });
    expect(pre.statusCode).toBe(204);
    expect(String(pre.headers["access-control-allow-headers"]).toLowerCase()).toContain("authorization");
  });

  it("serves the writes with the code and keeps the Host and Origin checks", async () => {
    const { call } = make();
    const auth = { authorization: `Bearer ${TOKEN}` };
    expect((await call("POST", "/session", auth, { asset: "KMMF" })).statusCode).toBe(200);
    expect((await call("POST", "/session/deposit", auth, { units: "1" })).json().error.code).toBe("SignerModeDisabled");
    expect((await call("GET", "/session", { host: "evil.example.com" })).statusCode).toBe(403);
    expect((await call("GET", "/session", { origin: "https://evil.example.com" })).statusCode).toBe(403);
  });

  it("lets the platform probe reach /api/health only", async () => {
    const { call } = make();
    expect((await call("GET", "/health", { host: "healthcheck.railway.app", origin: "" })).statusCode).toBe(200);
    expect((await call("GET", "/config", { host: "healthcheck.railway.app" })).statusCode).toBe(403);
  });
});

describe("durable session and uncertain transactions", () => {
  let dir = "";
  afterEach(() => dir && rmSync(dir, { recursive: true, force: true }));

  /** A vault whose next deposit is sent but never confirmed (RPC timeout). */
  class Flaky extends FakeVaultClient {
    lose: string | null = null;
    override async deposit(vaultId: string, units: bigint): Promise<TxResult> {
      if (this.lose) {
        const e = new KeeperError("RpcUnavailable", "No confirmation");
        e.txHash = this.lose;
        throw e;
      }
      return super.deposit(vaultId, units);
    }
  }

  const make = (client = new Flaky(), clock = { ms: 1_800_000_000_000 }) => {
    dir = dir || mkdtempSync(join(tmpdir(), "keystone-store-"));
    const sessions = new SessionManager({
      client, config: config("keeper"), scenario, euribor, store: new SessionStore(dir), now: () => new Date(clock.ms),
    });
    return { client, clock, sessions };
  };

  it("restores the session and its feed after a restart", async () => {
    const a = make();
    const started = await a.sessions.start("KMMF");
    await a.sessions.deposit(5_000_000n);
    const b = make(a.client, a.clock);
    await b.sessions.restore();
    const state = await b.sessions.getState();
    expect(state.vaultId).toBe(started.vaultId);
    expect(state.sessionId).toBe(started.sessionId);
    expect(state.vault.availableUnits).toBe("5000000");
    const feed = b.sessions.replay().filter((m) => m.event === "activity");
    expect(feed.map((m) => (m.data as { type: string }).type)).toEqual(["session_started", "deposit"]);
    // bigint fields survived: a rate shock still computes against the restored swap
    await expect(b.sessions.rateShock(50)).resolves.toBeTruthy();
  });

  it("starts clean when the saved vault no longer exists, keeping a copy", async () => {
    const a = make();
    await a.sessions.start("KMMF");
    const b = make(new Flaky(), a.clock); // a fresh chain: the saved vault is unknown to it
    await b.sessions.restore();
    await expect(b.sessions.getState()).rejects.toMatchObject({ code: "NoSession" });
  });

  it("blocks every write while a sent transaction is unconfirmed, then settles it by hash", async () => {
    const { client, sessions } = make();
    await sessions.start("KMMF");
    client.lose = "ab".repeat(32);
    await expect(sessions.deposit(1_000_000n)).rejects.toMatchObject({ code: "RpcUnavailable" });
    client.lose = null;

    // Not found yet and still inside its validity window: nothing else may be sent.
    for (const attempt of [() => sessions.deposit(1_000_000n), () => sessions.rateShock(10), () => sessions.start("KBOND"), () => sessions.prepare("deposit", 1n)]) {
      await expect(attempt()).rejects.toMatchObject({ code: "PendingTransaction" });
    }
    const pending = sessions.replay().map((m) => m.data as { status: string; txHash?: string }).find((e) => e.status === "pending");
    expect(pending?.txHash).toBe("ab".repeat(32));

    // The network reports it confirmed: the entry settles and the next write goes through.
    client.known.set("ab".repeat(32), "SUCCESS");
    await sessions.deposit(2_000_000n);
    const types = sessions.replay().filter((m) => m.event === "activity").map((m) => m.data as { status: string; txHash?: string });
    expect(types.filter((e) => e.status === "pending")).toHaveLength(0);
    expect(types.find((e) => e.txHash === "ab".repeat(32))?.status).toBe("confirmed");
  });

  it("declares a transaction that never landed failed only after it has expired", async () => {
    const { client, clock, sessions } = make();
    await sessions.start("KMMF");
    client.lose = "cd".repeat(32);
    await expect(sessions.deposit(1_000_000n)).rejects.toMatchObject({ code: "RpcUnavailable" });
    client.lose = null;
    await expect(sessions.deposit(1_000_000n)).rejects.toMatchObject({ code: "PendingTransaction" });
    clock.ms += 300_000;
    await expect(sessions.deposit(1_000_000n)).resolves.toBeTruthy();
    const lost = sessions.replay().map((m) => m.data as { txHash?: string; status: string }).find((e) => e.txHash === "cd".repeat(32));
    expect(lost?.status).toBe("failed");
  });

  it("remembers an unconfirmed transaction across a restart", async () => {
    const a = make();
    await a.sessions.start("KMMF");
    a.client.lose = "ef".repeat(32);
    await expect(a.sessions.deposit(1_000_000n)).rejects.toMatchObject({ code: "RpcUnavailable" });
    a.client.lose = null;
    const b = make(a.client, a.clock);
    await b.sessions.restore();
    await expect(b.sessions.deposit(1_000_000n)).rejects.toMatchObject({ code: "PendingTransaction" });
  });
});
