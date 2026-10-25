// Creates the local .env from .env.example if needed, then generates the Testnet keys
// that are still empty: issuer, bank and keeper. FUND_SECRET is never generated: the
// operator fills it with the demo fund account (the one imported in Freighter).
// Prints public keys only. Secrets stay in .env, which is git-ignored.
import { chmodSync, copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Keypair } from "@stellar/stellar-sdk";
import { fillEmptyEnv, readEnvValue } from "./lib/env.ts";

const ENV = fileURLToPath(new URL("../.env", import.meta.url));
const EXAMPLE = fileURLToPath(new URL("../.env.example", import.meta.url));
const GENERATED = ["ISSUER_SECRET", "BANK_SECRET", "KEEPER_SECRET"] as const;

if (!existsSync(ENV)) {
  copyFileSync(EXAMPLE, ENV);
  console.log("Created .env from .env.example");
}
chmodSync(ENV, 0o600); // before any secret is written

const before = readFileSync(ENV, "utf8");
const values: Record<string, string> = {};
for (const key of GENERATED) {
  if (!readEnvValue(before, key)) values[key] = Keypair.random().secret();
}
const { content, written } = fillEmptyEnv(before, values);
writeFileSync(ENV, content);

for (const key of GENERATED) {
  const secret = readEnvValue(content, key)!;
  const state = written.includes(key) ? "generated" : "kept";
  console.log(`${key.padEnd(14)} ${state.padEnd(9)} public key ${Keypair.fromSecret(secret).publicKey()}`);
}
console.log(readEnvValue(content, "FUND_SECRET")
  ? "FUND_SECRET    set by the operator"
  : "FUND_SECRET    empty: the operator fills it with the demo fund account (never generated here)");
