// REST + SSE API of docs/interfaces.md section 4, mounted under /api.
import cors from "@fastify/cors";
import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import type { AssetId, KeystoneConfig } from "@keystone/shared";
import { KeeperError } from "./errors.ts";
import type { SessionManager, StreamMessage } from "./session.ts";

const I128_MAX = (1n << 127n) - 1n;
const HEARTBEAT_MS = 15_000;

function parseUnits(body: unknown): bigint {
  const units = (body as { units?: unknown } | null)?.units;
  if (typeof units !== "string" || !/^[1-9]\d*$/.test(units) || BigInt(units) > I128_MAX) {
    throw new KeeperError("BadRequest", "units must be a positive integer string (smallest unit)");
  }
  return BigInt(units);
}

const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/** Default CORS policy: only pages served from the developer's own machine may call the keeper. */
export const isLocalOrigin = (origin: string): boolean => LOCAL_ORIGIN.test(origin);

export interface ServerOptions {
  /** Which browser origins may call the API. Default: local pages only (`isLocalOrigin`). */
  allowedOrigin?: (origin: string) => boolean;
}

export function buildServer(config: KeystoneConfig, sessions: SessionManager, options: ServerOptions = {}): FastifyInstance {
  const allowed = options.allowedOrigin ?? isLocalOrigin;
  const app = Fastify({ logger: false, forceCloseConnections: true });
  const streams = new Set<FastifyReply>();

  app.register(cors, { origin: (origin, cb) => cb(null, !origin || allowed(origin)) });

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
    api.get("/config", async () => config);

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
      req.raw.on("close", () => {
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
