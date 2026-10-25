// K2 — idempotent Testnet bootstrap (docs/plan.md section 13). Safe to run again:
// each step checks the ledger first and only sends what is missing.
//
// 1. Issuer, bank and keeper accounts (friendbot if they do not exist).
// 2. Issuer without `auth_required` (the vault must hold the assets freely).
// 3. Bank trustlines for KMMF and KBOND (settle_default pays the bank).
// 4. Stellar Asset Contracts of KMMF and KBOND.
// 5. With FUND_SECRET only: fund trustlines, then issuance up to 1 000 units of each asset.
// 6. deployments/testnet.json (public IDs and proof hashes, never a secret).
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Asset, Operation } from "@stellar/stellar-sdk";
import type { AssetId } from "@keystone/shared";
import { fromSmallest, toSmallest } from "./lib/amounts.ts";
import { emptyDeployments, mergeDeployments, readDeployments, writeDeployments, type DeployedAsset } from "./lib/deployments.ts";
import {
  ASSET_CODES,
  TESTNET,
  balanceOf,
  ensureAccount,
  ensureSac,
  ensureTrustline,
  horizon,
  keypairFromEnv,
  submitClassic,
} from "./lib/stellar.ts";

const ENV = fileURLToPath(new URL("../.env", import.meta.url));
const DEPLOYMENTS = fileURLToPath(new URL("../deployments/testnet.json", import.meta.url));
const FUND_TARGET = toSmallest("1000"); // units of each asset held by the demo fund

if (!existsSync(ENV)) throw new Error("No .env file: run `npm run init-env` first");
process.loadEnvFile(ENV);

const issuer = keypairFromEnv("ISSUER_SECRET", process.env.ISSUER_SECRET);
const bank = keypairFromEnv("BANK_SECRET", process.env.BANK_SECRET);
const keeper = keypairFromEnv("KEEPER_SECRET", process.env.KEEPER_SECRET);
const fund = keypairFromEnv("FUND_SECRET", process.env.FUND_SECRET);
if (!issuer || !bank || !keeper) {
  throw new Error("ISSUER_SECRET, BANK_SECRET and KEEPER_SECRET are required: run `npm run init-env`");
}

const tx = (hash: string) => `${TESTNET.explorerTxBase}${hash}`;
const log = (msg: string) => console.log(msg);

log("Keystone bootstrap — Stellar Testnet");

// 1. Accounts
for (const [role, kp] of [["issuer", issuer], ["bank", bank], ["keeper", keeper]] as const) {
  const { created } = await ensureAccount(kp.publicKey());
  log(`account ${role.padEnd(6)} ${kp.publicKey()} ${created ? "created with friendbot" : "exists"}`);
}

// 2. Issuer flags
const issuerAccount = await horizon.loadAccount(issuer.publicKey());
if (issuerAccount.flags.auth_required) {
  throw new Error("The issuer has auth_required set: the vault could not hold KMMF and KBOND (docs/interfaces.md section 2)");
}
log("issuer flags   auth_required not set");

const assets = Object.fromEntries(
  (Object.keys(ASSET_CODES) as AssetId[]).map((id) => [id, new Asset(ASSET_CODES[id], issuer.publicKey())]),
) as Record<AssetId, Asset>;

// 3. Bank trustlines
for (const [id, asset] of Object.entries(assets)) {
  const hash = await ensureTrustline(bank, asset);
  log(`bank trustline ${id.padEnd(5)} ${hash ? `added ${tx(hash)}` : "exists"}`);
}

// 4. Stellar Asset Contracts
const deployed: Partial<Record<AssetId, DeployedAsset>> = {};
for (const [id, asset] of Object.entries(assets) as [AssetId, Asset][]) {
  const { contractId, txHash } = await ensureSac(keeper, asset);
  deployed[id] = { code: asset.getCode(), issuer: issuer.publicKey(), sac: contractId, sacDeployTx: txHash };
  log(`SAC ${id.padEnd(5)}      ${contractId} ${txHash ? `deployed ${tx(txHash)}` : "exists"}`);
}

// 5. Fund trustlines and issuance (needs the operator's FUND_SECRET)
if (fund) {
  await ensureAccount(fund.publicKey());
  for (const [id, asset] of Object.entries(assets)) {
    const trust = await ensureTrustline(fund, asset);
    log(`fund trustline ${id.padEnd(5)} ${trust ? `added ${tx(trust)}` : "exists"}`);
    const account = await horizon.loadAccount(fund.publicKey());
    const held = toSmallest(balanceOf(account, asset) ?? "0");
    if (held < FUND_TARGET) {
      const amount = fromSmallest(FUND_TARGET - held);
      const hash = await submitClassic(issuer, Operation.payment({ destination: fund.publicKey(), asset, amount }));
      log(`issue ${id.padEnd(5)}        ${amount} to the fund ${tx(hash)}`);
    } else {
      log(`issue ${id.padEnd(5)}        fund already holds ${fromSmallest(held)}`);
    }
  }
} else {
  log("fund           FUND_SECRET empty: fund trustlines and issuance skipped");
}

// 6. deployments/testnet.json
const current = readDeployments(DEPLOYMENTS, emptyDeployments(TESTNET));
const next = mergeDeployments(current, {
  accounts: { issuer: issuer.publicKey(), bank: bank.publicKey(), keeper: keeper.publicKey(), fund: fund?.publicKey() ?? null },
  assets: deployed,
}, new Date());
writeDeployments(DEPLOYMENTS, next);
log(`wrote deployments/testnet.json`);
