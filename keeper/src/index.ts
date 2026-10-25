// Keeper entry point. Only the in-memory backend exists until the contract client is wired.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SignerMode } from "@keystone/shared";
import { buildConfig } from "./config.ts";
import { getEuribor } from "./euribor.ts";
import { FakeVaultClient } from "./fake-vault-client.ts";
import { loadScenarioFile } from "./scenarios.ts";
import { buildServer } from "./server.ts";
import { SessionManager } from "./session.ts";

const here = dirname(fileURLToPath(import.meta.url));
const keeperDir = join(here, "..");
const repoRoot = join(keeperDir, "..");

const signer = process.env.SIGNER ?? "freighter";
if (signer !== "freighter" && signer !== "keeper") throw new Error(`SIGNER must be freighter or keeper, got "${signer}"`);
const port = Number(process.env.PORT ?? 8787);
if (!Number.isInteger(port) || port <= 0) throw new Error("PORT must be a positive integer");

if (process.env.KEEPER_BACKEND !== "fake") {
  console.error(
    "The Testnet vault client is not wired yet (waiting for the contract, task C1).\n" +
    "Start the in-memory backend explicitly with KEEPER_BACKEND=fake: transaction hashes are fake and nothing touches Testnet.",
  );
  process.exit(1);
}

const scenario = loadScenarioFile(join(keeperDir, "scenarios", "default.json"));
const config = buildConfig(join(repoRoot, "deployments", "testnet.json"), scenario, signer as SignerMode);
const cachePath = join(keeperDir, "data", "euribor-cache.json");
const sessions = new SessionManager({
  client: new FakeVaultClient(),
  config,
  scenario,
  euribor: () => getEuribor({ cachePath }),
});

const app = buildServer(config, sessions);
await app.listen({ port, host: "127.0.0.1" });
console.log(`Keeper listening on http://127.0.0.1:${port}/api (SIGNER=${signer}, backend: in-memory FAKE, no Testnet transaction)`);
