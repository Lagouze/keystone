// REST + SSE API of docs/interfaces.md section 4, mounted under /api.
import cors from "@fastify/cors";
import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import type { AssetId, KeystoneConfig, MarketSnapshot } from "@keystone/shared";
import { createMarketProvider, unavailableMarket } from './market-data.ts';
import { makeAuthorizer } from "./access.ts";
import { KeeperError } from "./errors.ts";
import type { SessionManager, StreamMessage } from "./session.ts";

const I128_MAX = (1n << 127n) - 1n;
const HEARTBEAT_MS = 15_000;
const MAX_STREAMS = 100;
const MAX_STREAMS_PER_IP = 10;
/** Railway's health probe calls /api/health with this Host; it is let through for that route only. */
const PROBE_HOST = "healthcheck.railway.app";

function parseUnits(body: unknown): bigint {
  const units = (body as { units?: unknown } | null)?.units;
  if (typeof units !== "string" || !/^[1-9]\d*$/.test(units) || BigInt(units) > I128_MAX) {
    throw new KeeperError("BadRequest", "units must be a positive integer string (smallest unit)");
  }
  return BigInt(units);
}

const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/** Default CORS policy: only pages served from the developer's own machine may call the keeper. */
export const isLocalOrigin = (origin: string): boolean => LOCAL_ORIGIN.test(origin);

export interface ServerOptions {
  /** Read-only public sources; does not receive a session or any Stellar signer. */
  market?: () => Promise<MarketSnapshot>;
  /** Which browser origins may call the API. Default: local pages only (`isLocalOrigin`). */
  allowedOrigin?: (origin: string) => boolean;
  /** Which `Host` header values are served. Default: loopback names only, against DNS rebinding. */
  allowedHost?: (host: string) => boolean;
  /** Accepted access codes. When set, every POST route needs `Authorization: Bearer <code>`. */
  accessTokens?: string[];
  /** Shown by GET /config so the interface never presents a fake vault as the real one. Default "fake". */
  backend?: "testnet" | "fake";
  /** Number of reverse proxies in front of the keeper (hosted), for the client address. */
  trustProxyHops?: number;
}

export function buildServer(config: KeystoneConfig, sessions: SessionManager, options: ServerOptions = {}): FastifyInstance {
  const allowed = options.allowedOrigin ?? isLocalOrigin;
  const allowedHost = options.allowedHost ?? ((h: string) => LOCAL_HOST.test(h));
  const tokens = options.accessTokens ?? [];
  const authorized = makeAuthorizer(tokens);
  const app = Fastify({
    logger: false, forceCloseConnections: true,
    // Trust only the `trustProxyHops` addresses closest to the socket: a client cannot forge its own address.
    ...(options.trustProxyHops ? { trustProxy: (_address: string, hop: number) => hop < options.trustProxyHops! } : {}),
  });
  const streams = new Set<FastifyReply>();
  const streamsByIp = new Map<string, number>();
  const market = options.market ?? createMarketProvider();

  // A page that rebinds its DNS name to 127.0.0.1 is same-origin with the keeper and bypasses CORS:
  // refuse any request whose Host or Origin is not expected.
  app.addHook("onRequest", async (req, reply) => {
    const origin = req.headers.origin;
    const probe = req.headers.host === PROBE_HOST && req.method === "GET" && req.url === "/api/health";
    if (!probe && (!allowedHost(req.headers.host ?? "") || (origin !== undefined && !allowed(origin)))) {
      return reply.status(403).send({ error: { code: "BadRequest", message: "Host or Origin not allowed" } });
    }
  });
  // Every route that can deploy a vault, post margin, spend fees or move collateral is a POST.
  if (tokens.length > 0) {
    // preParsing: after the CORS headers are added (so the browser can read the 401), before any body is read.
    app.addHook("preParsing", async (req) => {
      if (req.method === "OPTIONS" || req.method === "GET" || req.method === "HEAD") return;
      if (!authorized(req.headers.authorization)) {
        throw new KeeperError("Unauthorized", "A valid access code is required for this action");
      }
    });
  }
  app.register(cors, { allowedHeaders: ["authorization", "content-type"], origin: (origin, cb) => cb(null, !origin || allowed(origin)) });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof KeeperError) {
      return reply.status(err.httpStatus).send({ error: { code: err.code, message: err.message } });
    }
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500) {
      return reply.status(400).send({ error: { code: "BadRequest", message: (err as Error).message } });
    }
    app.log.error(err);
    return reply.status(500).send({ error: { code: "InternalError", message: "Unexpected keeper error" } });
  });
  app.setNotFoundHandler((_req, reply) =>
    reply.status(404).send({ error: { code: "NotFound", message: "Unknown route" } }));

  app.register(async (api) => {
    const requireMode = (mode: "freighter" | "keeper") => {
      if (config.signerMode !== mode) {
        throw new KeeperError("SignerModeDisabled", `This route needs SIGNER=${mode}; the keeper runs with SIGNER=${config.signerMode}`);
      }
    };

    api.get("/health", async () => ({ ok: true, network: "testnet" as const }));
    api.get("/config", async () => ({ ...config, backend: options.backend ?? "fake", writeAuth: tokens.length > 0 ? "token" : "none" }));
    api.get('/market-advisor', async (_req, reply) => {
      reply.header('Cache-Control', 'no-store');
      try { return await market(); }
      catch { return unavailableMarket(); }
    });

    api.post("/session", async (req) => {
      const asset = (req.body as { asset?: unknown } | null)?.asset;
      if (!config.assets.some((a) => a.id === asset)) {
        throw new KeeperError("BadRequest", `asset must be one of ${config.assets.map((a) => a.id).join(", ")}`);
      }
      return sessions.start(asset as AssetId);
    });
    api.get("/session", async () => sessions.getState());

    api.post("/session/deposit/prepare", async (req) => {
      requireMode("freighter");
      const units = parseUnits(req.body);
      return { txXdr: await sessions.prepare("deposit", units) };
    });
    api.post("/session/withdraw/prepare", async (req) => {
      requireMode("freighter");
      const units = parseUnits(req.body);
      return { txXdr: await sessions.prepare("withdraw", units) };
    });
    api.post("/session/submit", async (req) => {
      requireMode("freighter");
      const xdr = (req.body as { signedTxXdr?: unknown } | null)?.signedTxXdr;
      if (typeof xdr !== "string" || xdr.length === 0) throw new KeeperError("BadRequest", "signedTxXdr must be a non-empty string");
      return sessions.submit(xdr);
    });
    api.post("/session/deposit", async (req) => {
      requireMode("keeper");
      return sessions.deposit(parseUnits(req.body));
    });
    api.post("/session/withdraw", async (req) => {
      requireMode("keeper");
      return sessions.withdraw(parseUnits(req.body));
    });
    api.post("/session/rate-shock", async (req) => {
      const bp = (req.body as { bp?: unknown } | null)?.bp;
      if (typeof bp !== "number" || !Number.isInteger(bp)) throw new KeeperError("BadRequest", "bp must be an integer number");
      return sessions.rateShock(bp);
    });
    api.post("/session/settle-default", async () => sessions.settleDefault());

    api.get("/events", (req, reply) => {
      const ip = req.ip;
      if (streams.size >= MAX_STREAMS || (streamsByIp.get(ip) ?? 0) >= MAX_STREAMS_PER_IP) {
        return reply.status(503).send({ error: { code: "RpcUnavailable", message: "Too many open streams: try again shortly" } });
      }
      reply.hijack();
      const res = reply.raw;
      const origin = req.headers.origin;
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        ...(origin && allowed(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
      });
      const write = (m: StreamMessage) => res.write(`event: ${m.event}\ndata: ${JSON.stringify(m.data)}\n\n`);
      res.write(": connected\n\n");
      // Subscribe before replaying: nothing can slip between the history and the live stream.
      const unsubscribe = sessions.subscribe(write);
      for (const m of sessions.replay()) write(m);
      const heartbeat = setInterval(() => res.write(": ping\n\n"), HEARTBEAT_MS);
      streams.add(reply);
      streamsByIp.set(ip, (streamsByIp.get(ip) ?? 0) + 1);
      req.raw.on("close", () => {
        const left = (streamsByIp.get(ip) ?? 1) - 1;
        if (left > 0) streamsByIp.set(ip, left); else streamsByIp.delete(ip);
        clearInterval(heartbeat);
        unsubscribe();
        streams.delete(reply);
      });
    });
  }, { prefix: "/api" });

  // Open SSE connections would keep close() waiting: end them first.
  app.addHook("preClose", async () => {
    for (const r of streams) r.raw.end();
  });

  return app;
}
