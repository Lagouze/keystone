// Testnet integration run of scenario 1 on the real C1 vault, through the same SessionManager the API uses.
// Spends demo tokens of the fund account (recovered by the final withdrawals). Needs a local .env with
// KEEPER_SECRET and FUND_SECRET. Prints public data only: hashes, amounts, statuses.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Keypair } from "vault-client";
import { buildConfig } from "../src/config.ts";
import { getEuribor } from "../src/euribor.ts";
import { loadScenarioFile } from "../src/scenarios.ts";
import { SessionManager } from "../src/session.ts";
import { TestnetVaultClient } from "../src/testnet-vault-client.ts";

const keeperDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(keeperDir, "..");
process.loadEnvFile(join(repoRoot, ".env"));

const scenario = loadScenarioFile(join(keeperDir, "scenarios", "default.json"));
const deploymentsPath = join(repoRoot, "deployments", "testnet.json");
const config = buildConfig(deploymentsPath, scenario, "keeper");
const d = JSON.parse(readFileSync(deploymentsPath, "utf8"));
const key = (name: string, expected: string) => {
  const kp = Keypair.fromSecret(process.env[name]!);
  if (kp.publicKey() !== expected) throw new Error(`${name} does not match deployments/testnet.json`);
  return kp;
};
const client = new TestnetVaultClient({
  rpcUrl: d.rpcUrl, networkPassphrase: d.networkPassphrase, wasmHash: d.vault.wasmHash,
  keeper: key("KEEPER_SECRET", config.accounts.keeper), fundKeypair: key("FUND_SECRET", config.accounts.fund),
  fundAddress: config.accounts.fund,
});
const sessions = new SessionManager({
  client, config, scenario, euribor: () => getEuribor({ cachePath: join(keeperDir, "data", "euribor-cache.json") }),
});

const units = (u: string) => `${(Number(u) / 1e7).toFixed(4)} KMMF`;
const fails: string[] = [];
const check = (ok: boolean, what: string) => { console.log(`  ${ok ? "OK  " : "FAIL"} ${what}`); if (!ok) fails.push(what); };

async function step(title: string, run: () => Promise<unknown>) {
  console.log(`\n== ${title}`);
  await run();
  const s = await sessions.getState();
  const chain = await client.getState(s.vaultId); // second, independent read of the vault
  console.log(`  vault ${s.vaultId}`);
  console.log(`  available ${units(s.vault.availableUnits)}, locked ${units(s.vault.lockedUnits)}, required ${units(s.vault.requiredUnits)}, shortfall ${units(s.vault.shortfallUnits)}, status ${s.vault.status}, epoch ${s.vault.epoch}`);
  console.log(`  fund ${units(s.balances.fundUnits)}, bank ${units(s.balances.bankUnits)}; float ${s.swap.floatRatePct} % (${s.swap.floatRateSource}), K ${s.swap.fixedRatePct} %`);
  check(chain.available.toString() === s.vault.availableUnits && chain.locked.toString() === s.vault.lockedUnits, "SessionState matches get_state");
  return s;
}

const deposit = (u: string) => sessions.deposit(BigInt(u));
await step("1. POST /session (deploy a new vault for KMMF)", () => sessions.start("KMMF"));
const afterDeposit = await step("2. deposit 300 KMMF (signed by the demo fund key)", () => deposit("3000000000"));
check(afterDeposit.vault.availableUnits === "3000000000", "300 KMMF available");
const locked = await step("3. rate shock -50 bp (post_margin, collateral locked)", () => sessions.rateShock(-50));
check(locked.vault.lockedUnits === locked.margin.requiredUnits && locked.vault.lockedUnits !== "0", "locked = computed requirement");
check(BigInt(locked.vault.availableUnits) + BigInt(locked.vault.lockedUnits) === 3000000000n, "available + locked = 300 KMMF");
const call = await step("4. rate shock -30 bp (shortfall, margin call)", () => sessions.rateShock(-30));
check(call.vault.status === "margin_call" && call.vault.callDeadline !== null && BigInt(call.vault.shortfallUnits) > 0n, "margin call with a deadline");
const cured = await step("5. deposit 100 KMMF (cure)", () => deposit("1000000000"));
check(cured.vault.status === "active" && cured.vault.shortfallUnits === "0", "cured, back to active");
const released = await step("6. rate shock +60 bp (collateral released)", () => sessions.rateShock(60));
check(BigInt(released.vault.lockedUnits) < BigInt(call.vault.requiredUnits), "locked decreased");
await step("7. withdraw the released collateral", () => sessions.withdraw(BigInt(released.vault.availableUnits)));
const clean = await step("8. rate shock +30 bp (requirement back to zero)", () => sessions.rateShock(30));
check(clean.vault.lockedUnits === "0", "nothing locked");
const final = await step("9. withdraw everything left", () => sessions.withdraw(BigInt(clean.vault.availableUnits)));
check(final.vault.availableUnits === "0" && final.vault.lockedUnits === "0", "vault empty");

console.log("\n== Activity feed (chain entries)");
for (const e of sessions.replay()) {
  if (e.event === "activity" && e.data.kind === "chain" && e.data.status === "confirmed") {
    console.log(`  ${e.data.type.padEnd(15)} ${e.data.txHash}  ${e.data.title}`);
  }
}
console.log(fails.length ? `\n${fails.length} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(fails.length ? 1 : 0);
