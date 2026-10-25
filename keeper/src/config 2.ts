import { readFileSync } from "node:fs";
import type { AssetId, KeystoneConfig, SignerMode } from "@keystone/shared";
import type { ScenarioFile } from "./scenarios.ts";

interface DeploymentsFile {
  networkPassphrase: string;
  explorerTxBase: string;
  accounts: { issuer: string | null; fund: string | null; bank: string | null; keeper: string | null };
  assets: Partial<Record<AssetId, { code: string; issuer: string; sac: string }>>;
}

/** Builds the `KeystoneConfig` of GET /config from deployments/testnet.json and the scenario file. */
export function buildConfig(deploymentsPath: string, scenario: ScenarioFile, signerMode: SignerMode): KeystoneConfig {
  const d = JSON.parse(readFileSync(deploymentsPath, "utf8")) as DeploymentsFile;
  const { fund, bank, keeper } = d.accounts;
  if (!fund || !bank || !keeper) throw new Error("deployments/testnet.json lacks the fund, bank or keeper account: run `npm run bootstrap`");
  return {
    network: "testnet",
    networkPassphrase: d.networkPassphrase,
    explorerTxBase: d.explorerTxBase,
    accounts: { fund, bank, keeper },
    assets: (["KMMF", "KBOND"] as const).map((id) => {
      const a = d.assets[id];
      if (!a) throw new Error(`deployments/testnet.json lacks ${id}: run \`npm run bootstrap\``);
      const p = scenario.assets[id];
      return {
        id, code: a.code, issuer: a.issuer, sac: a.sac, decimals: 7,
        label: p.label, unitPriceEur: p.unitPriceEur, haircutPct: p.haircutPct,
      };
    }),
    signerMode,
  };
}
