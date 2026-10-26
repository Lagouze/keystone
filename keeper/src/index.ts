// Keeper entry point. KEEPER_BACKEND=testnet uses the real vault on Stellar Testnet,
// KEEPER_BACKEND=fake an in-memory vault (fake hashes, no transaction).
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Keypair } from "vault-client";
import type { SignerMode } from "@keystone/shared";
import { originMatcher } from "./access.ts";
import { buildConfig } from "./config.ts";
import { readExposure } from "./hosted.ts";
import { getEuribor } from "./euribor.ts";
import { createMarketProvider } from './market-data.ts';
import { FakeVaultClient } from "./fake-vault-client.ts";
import { loadScenarioFile } from "./scenarios.ts";
import { buildServer, isLocalOrigin } from "./server.ts";
import { SessionManager } from "./session.ts";
import { SessionStore } from "./store.ts";
import { TestnetVaultClient } from "./testnet-vault-client.ts";
import type { VaultClient } from "./vault-client.ts";

const here = dirname(fileURLToPath(import.meta.url));
const keeperDir = join(here, "..");
const repoRoot = join(keeperDir, "..");
if (existsSync(join(repoRoot, ".env"))) process.loadEnvFile(join(repoRoot, ".env"));

const signer = process.env.SIGNER || "freighter";
if (signer !== "freighter" && signer !== "keeper") throw new Error(`SIGNER must be freighter or keeper, got "${signer}"`);
const port = Number(process.env.PORT || 8787);
if (!Number.isInteger(port) || port <= 0) throw new Error("PORT must be a positive integer");
// Loopback by default (a developer's machine). A hosted keeper sets KEEPER_HOST=0.0.0.0 and is then public:
// it needs access codes, an explicit list of hosts and origins, and never signs with the fund key.
const { host, hosted, accessTokens } = readExposure(process.env, signer);
const backend = process.env.KEEPER_BACKEND;
if (backend !== "fake" && backend !== "testnet") {
  console.error("Set KEEPER_BACKEND=testnet (real vault on Stellar Testnet) or KEEPER_BACKEND=fake (in-memory, fake hashes).");
  process.exit(1);
}

const deploymentsPath = join(repoRoot, "deployments", "testnet.json");
const scenario = loadScenarioFile(join(keeperDir, "scenarios", "default.json"));
const config = buildConfig(deploymentsPath, scenario, signer as SignerMode);

function secretKey(name: string, expected: string): Keypair {
  const secret = process.env[name];
  if (!secret) throw new Error(`${name} is empty: set it in the local .env`);
  const kp = Keypair.fromSecret(secret);
  if (kp.publicKey() !== expected) throw new Error(`${name} does not match the ${expected} account of deployments/testnet.json`);
  return kp;
}

function makeClient(): VaultClient {
  if (backend === "fake") return new FakeVaultClient();
  const d = JSON.parse(readFileSync(deploymentsPath, "utf8")) as {
    rpcUrl: string; networkPassphrase: string; vault: { wasmHash: string | null };
  };
  if (!d.vault.wasmHash) throw new Error("deployments/testnet.json has no vault.wasmHash");
  return new TestnetVaultClient({
    rpcUrl: d.rpcUrl,
    networkPassphrase: d.networkPassphrase,
    wasmHash: d.vault.wasmHash,
    keeper: secretKey("KEEPER_SECRET", config.accounts.keeper),
    fundKeypair: signer === "keeper" ? secretKey("FUND_SECRET", config.accounts.fund) : undefined,
    fundAddress: config.accounts.fund,
  });
}

const list = (name: string) => (process.env[name] || "").split(",").map((o) => o.trim()).filter(Boolean);
const extraOrigins = list("KEEPER_ALLOWED_ORIGINS");
const matchesOrigin = originMatcher(extraOrigins);
const publicHosts = list("KEEPER_PUBLIC_HOSTS");
// Where the keeper keeps what must survive a restart: on a host, a mounted volume (KEEPER_DATA_DIR=/data).
const dataDir = process.env.KEEPER_DATA_DIR || join(keeperDir, "data");
// A fresh data directory starts from the versioned Euribor seed, as a local run does.
const seed = join(keeperDir, "data", "euribor-cache.json");
if (dataDir !== join(keeperDir, "data") && existsSync(seed) && !existsSync(join(dataDir, "euribor-cache.json"))) {
  mkdirSync(dataDir, { recursive: true });
  copyFileSync(seed, join(dataDir, "euribor-cache.json"));
}
const store = backend === "testnet" ? new SessionStore(dataDir) : undefined;
// A keeper that cannot save its session would forget a funded vault on the next restart: refuse to run.
if (store && hosted) store.assertWritable();
const sessions = new SessionManager({
  client: makeClient(),
  config,
  scenario,
  euribor: () => getEuribor({ cachePath: join(dataDir, "euribor-cache.json") }),
  store,
});
// The saved session is read at once; the on-chain checks that follow must not hold up the listening socket.
void sessions.restore().catch((e: Error) => console.error(`Could not restore the saved session: ${e.message}`));
sessions.startReconciler();
const app = buildServer(config, sessions, {
  market: createMarketProvider({
    cachePath: join(dataDir, 'market-cache.local.json'),
  }),
  // On a host, pages served from the visitor's own machine are not trusted: only the configured origins.
  allowedOrigin: (o) => (!hosted && isLocalOrigin(o)) || matchesOrigin(o),
  allowedHost: (h) => (!hosted && /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(h)) || publicHosts.includes(h),
  accessTokens,
  backend,
  healthProbeAnyHost: hosted,
  trustProxyHops: hosted ? Number(process.env.KEEPER_TRUST_PROXY_HOPS || 1) : undefined,
});
await app.listen({ port, host });
// A redeploy sends SIGTERM: stop taking requests, let the write in progress finish (its hash is saved), then exit.
let stopping = false;
for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, () => {
    if (stopping) return;
    stopping = true;
    const force = setTimeout(() => process.exit(1), 25_000);
    force.unref();
    void app.close().then(() => sessions.idle()).then(() => process.exit(0));
  });
}
console.log(
  `Keeper listening on http://${host}:${port}/api (SIGNER=${signer}, ` + (accessTokens.length ? `write routes need an access code, ` : "no access code, ") + `backend: ` +
  (backend === "fake" ? "in-memory FAKE, no Testnet transaction)" : "Stellar Testnet, real transactions)"),
);
