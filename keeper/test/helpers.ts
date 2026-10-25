import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { KeystoneConfig, SignerMode } from "@keystone/shared";
import type { EuriborResult } from "../src/euribor.ts";
import { FakeVaultClient } from "../src/fake-vault-client.ts";
import { buildServer } from "../src/server.ts";
import { loadScenarioFile } from "../src/scenarios.ts";
import { SessionManager } from "../src/session.ts";

export const scenario = loadScenarioFile(join(fileURLToPath(new URL("../scenarios", import.meta.url)), "default.json"));

export const config = (signerMode: SignerMode): KeystoneConfig => ({
  network: "testnet",
  networkPassphrase: "Test SDF Network ; September 2015",
  explorerTxBase: "https://stellar.expert/explorer/testnet/tx/",
  accounts: { fund: "GFUND", bank: "GBANK", keeper: "GKEEPER" },
  assets: (["KMMF", "KBOND"] as const).map((id) => ({
    id, code: id, issuer: "GISSUER", sac: `C${id}`, decimals: 7,
    label: scenario.assets[id].label, unitPriceEur: scenario.assets[id].unitPriceEur, haircutPct: scenario.assets[id].haircutPct,
  })),
  signerMode,
});

/** A keeper on the in-memory vault, with a controllable ledger clock and a fixed starting Euribor of 2.034 %. */
export function makeKeeper(signerMode: SignerMode = "keeper", euribor?: () => Promise<EuriborResult>, maxRequiredUnits?: string) {
  const clock = { seconds: 1_800_000_000n };
  const client = new FakeVaultClient({ now: () => clock.seconds });
  const cfg = config(signerMode);
  const sessions = new SessionManager({
    client, config: cfg,
    scenario: maxRequiredUnits ? { ...scenario, csa: { ...scenario.csa, maxRequiredUnits } } : scenario,
    euribor: euribor ?? (async () => ({ period: "2026-09", rateMilli: 2034, fetchedAt: "2026-10-25T00:00:00.000Z", source: "ecb" })),
    now: () => new Date(Number(clock.seconds) * 1000),
  });
  const app = buildServer(cfg, sessions);
  const post = async (url: string, payload?: unknown) => {
    const res = await app.inject({ method: "POST", url: `/api${url}`, payload: payload as object | undefined });
    return { status: res.statusCode, body: res.json() };
  };
  const get = async (url: string) => {
    const res = await app.inject({ method: "GET", url: `/api${url}` });
    return { status: res.statusCode, body: res.json() };
  };
  return { app, sessions, clock, post, get };
}
