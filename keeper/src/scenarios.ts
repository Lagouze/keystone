import { readFileSync } from "node:fs";
import type { AssetId } from "@keystone/shared";
import { parseScaled } from "./amounts.ts";

export type ScenarioStep =
  | { action: "deposit"; units?: string; note?: string }
  | { action: "withdraw"; units?: string; note?: string }
  | { action: "rate_shock"; bp: number }
  | { action: "wait_grace_period" }
  | { action: "settle_default" };

export interface ScenarioFile {
  swap: { notionalEur: string; tenorYears: number; paymentsPerYear: number; direction: "fund_pays_fixed" };
  csa: { thresholdEur: string; mtaEur: string; gracePeriodSecs: number; maxRequiredUnits: string };
  assets: Record<AssetId, { label: string; unitPriceEur: string; haircutPct: string }>;
  scenarios: { id: string; asset: AssetId; steps: ScenarioStep[] }[];
}

/** Loads and checks a scenario file; a malformed file stops the keeper at startup. */
export function loadScenarioFile(path: string): ScenarioFile {
  const f = JSON.parse(readFileSync(path, "utf8")) as ScenarioFile;
  if (f.swap.paymentsPerYear !== 4) throw new Error("Only quarterly payments are modelled");
  if (f.swap.direction !== "fund_pays_fixed") throw new Error("Only fund_pays_fixed is modelled");
  if (!Number.isInteger(f.swap.tenorYears) || f.swap.tenorYears < 1) throw new Error("Invalid tenorYears");
  if (!/^\d+$/.test(f.swap.notionalEur)) throw new Error("notionalEur must be whole euros");
  parseScaled(f.csa.thresholdEur, 2);
  parseScaled(f.csa.mtaEur, 2);
  if (!Number.isInteger(f.csa.gracePeriodSecs) || f.csa.gracePeriodSecs <= 0) throw new Error("Invalid gracePeriodSecs");
  if (!/^[1-9]\d*$/.test(f.csa.maxRequiredUnits)) throw new Error("Invalid maxRequiredUnits");
  for (const id of ["KMMF", "KBOND"] as const) {
    const a = f.assets[id];
    if (!a) throw new Error(`Missing asset ${id}`);
    parseScaled(a.unitPriceEur, 2);
    parseScaled(a.haircutPct, 2);
  }
  return f;
}
