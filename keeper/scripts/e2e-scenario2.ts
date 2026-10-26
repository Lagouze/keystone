// Testnet end-to-end run of scenario 2 (default, KBOND) on a fresh vault, through the same SessionManager the API uses.
// Needs a local .env with KEEPER_SECRET and FUND_SECRET. Prints public data only. The 300 KBOND of collateral
// ends up at the bank account, as the scenario intends.
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

const fails: string[] = [];
const check = (ok: boolean, what: string) => { console.log(`  ${ok ? "OK  " : "FAIL"} ${what}`); if (!ok) fails.push(what); };
const refused = async (what: string, run: () => Promise<unknown>, codes: string[]) => {
  try { await run(); check(false, `${what}: expected a refusal`); } catch (e) {
    const code = (e as { code?: string }).code ?? String(e);
    check(codes.includes(code), `${what} refused with ${code}`);
  }
};
const u = (x: string) => `${(Number(x) / 1e7).toFixed(4)} KBOND`;
const show = (s: Awaited<ReturnType<SessionManager["getState"]>>) =>
  console.log(`  available ${u(s.vault.availableUnits)}, locked ${u(s.vault.lockedUnits)}, required ${u(s.vault.requiredUnits)}, shortfall ${u(s.vault.shortfallUnits)}, status ${s.vault.status}, deadline ${s.vault.callDeadline}; fund ${u(s.balances.fundUnits)}, bank ${u(s.balances.bankUnits)}`);

console.log("== 1. POST /session (new vault, KBOND)");
const created = await sessions.start("KBOND");
show(created);
const bankBefore = BigInt(created.balances.bankUnits);

console.log("== 2. deposit 300 KBOND");
const dep = await sessions.deposit(3_000_000_000n);
show(dep);
check(dep.vault.availableUnits === "3000000000", "300 KBOND available");

console.log("== 3. rate shock -100 bp");
const call = await sessions.rateShock(-100);
show(call);
check(call.vault.status === "margin_call" && call.vault.callDeadline !== null, "margin call opened with a deadline");
check(BigInt(call.vault.shortfallUnits) > 0n && call.vault.lockedUnits === "3000000000", "shortfall, all collateral locked");
const lockedAtCall = BigInt(call.vault.lockedUnits);
const frozenMargin = call.margin;

console.log("== 4. premature settle_default");
await refused("premature settlement", () => sessions.settleDefault(), ["GracePeriodRunning"]);

console.log("== 5. waiting for the ledger deadline");
const deadline = BigInt(Math.floor(Date.parse(call.vault.callDeadline!) / 1000));
for (;;) {
  const now = await client.ledgerTime();
  if (now >= deadline) { console.log(`  ledger time ${now} >= deadline ${deadline}`); break; }
  await new Promise((r) => setTimeout(r, 3000));
}

console.log("== 6. settle_default (no role authorization, keeper only pays the fee)");
const done = await sessions.settleDefault();
show(done);
check(done.vault.status === "defaulted", "status defaulted");
check(done.vault.lockedUnits === "0" && done.vault.requiredUnits === "0" && done.vault.shortfallUnits === "0" && done.vault.callDeadline === null, "locked, required, shortfall and deadline cleared");
check(BigInt(done.balances.bankUnits) - bankBefore === lockedAtCall, `bank received exactly the ${u(lockedAtCall.toString())} locked`);
const settled = sessions.replay().flatMap((m) => (m.event === "activity" && m.data.type === "defaulted" && m.data.status === "confirmed" ? [m.data] : []));
check(settled.length === 1 && settled[0]!.title.includes(`${(Number(lockedAtCall) / 1e7).toFixed(7)} KBOND`) && !!settled[0]!.txHash, "defaulted feed entry carries the event amount and the hash");
const chain = await client.getState(done.vaultId);
check(chain.status === "Defaulted" && chain.locked === 0n && chain.epoch === 1n, "get_state: Defaulted, locked 0, epoch kept");
check(JSON.stringify(done.margin) === JSON.stringify(frozenMargin), "historical margin still displayed after default");

console.log("== 7. refusals after default");
await refused("replay settlement", () => sessions.settleDefault(), ["NotInMarginCall", "Defaulted"]);
await refused("deposit", () => sessions.deposit(10_000_000n), ["Defaulted"]);
await refused("rate shock", () => sessions.rateShock(10), ["Defaulted"]);
await refused("withdraw", () => sessions.withdraw(10_000_000n), ["InsufficientAvailable"]);

console.log("\n== Confirmed chain entries");
for (const e of sessions.replay()) {
  if (e.event === "activity" && e.data.kind === "chain" && e.data.status === "confirmed") console.log(`  ${e.data.type.padEnd(15)} ${e.data.txHash}  ${e.data.title}`);
}
console.log("== Failed attempts (no hash, not proofs)");
for (const e of sessions.replay()) if (e.event === "activity" && e.data.status === "failed") console.log(`  ${e.data.type.padEnd(15)} ${e.data.detail?.slice(0, 80)}`);
console.log(fails.length ? `\n${fails.length} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
process.exit(fails.length ? 1 : 0);
