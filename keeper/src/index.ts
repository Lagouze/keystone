// Keeper entry point. KEEPER_BACKEND=testnet uses the real vault on Stellar Testnet,
// KEEPER_BACKEND=fake an in-memory vault (fake hashes, no transaction).
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Keypair } from "vault-client";
import type { SignerMode } from "@keystone/shared";
import { buildConfig } from "./config.ts";
import { getEuribor } from "./euribor.ts";
import { FakeVaultClient } from "./fake-vault-client.ts";
import { loadScenarioFile } from "./scenarios.ts";
import { buildServer, isLocalOrigin } from "./server.ts";
import { SessionManager } from "./session.ts";
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

const extraOrigins = (process.env.KEEPER_ALLOWED_ORIGINS || "").split(",").map((o) => o.trim()).filter(Boolean);
const sessions = new SessionManager({
  client: makeClient(),
  config,
  scenario,
  euribor: () => getEuribor({ cachePath: join(keeperDir, "data", "euribor-cache.json") }),
});
const app = buildServer(config, sessions, { allowedOrigin: (o) => isLocalOrigin(o) || extraOrigins.includes(o) });
await app.listen({ port, host: "127.0.0.1" });
console.log(
  `Keeper listening on http://127.0.0.1:${port}/api (SIGNER=${signer}, backend: ` +
  (backend === "fake" ? "in-memory FAKE, no Testnet transaction)" : "Stellar Testnet, real transactions)"),
);
