// deployments/testnet.json: public on-chain identifiers, written by the keeper pole
// (docs/interfaces.md section 1). Never contains a secret.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import type { AssetId } from "@keystone/shared";

export interface DeployedAsset {
  code: string;
  issuer: string;            // G... issuer account
  sac: string;               // C... Stellar Asset Contract ID
  sacDeployTx: string | null; // hash of the transaction that deployed the SAC
}

export interface Deployments {
  network: "testnet";
  networkPassphrase: string;
  rpcUrl: string;
  horizonUrl: string;
  explorerTxBase: string;
  accounts: { issuer: string | null; fund: string | null; bank: string | null; keeper: string | null };
  assets: Partial<Record<AssetId, DeployedAsset>>;
  vault: {
    wasmHash: string | null;
    testVaultId: string | null;
    // proofs provided by the contract pole and the keeper (hashes of confirmed Testnet transactions)
    uploadTx?: string;
    deployTx?: string;
    testDepositTx?: string;
    // proof of the C2 settlement on an independent fixture, and the immutable C1 deployment kept for history
    c2?: { settlementFixtureVaultId: string; settlementFixtureSettleTx: string };
    c1?: { wasmHash: string | null; testVaultId: string | null; uploadTx?: string; deployTx?: string; testDepositTx?: string };
  };
  updatedAt: string;
}

export function emptyDeployments(
  base: Pick<Deployments, "networkPassphrase" | "rpcUrl" | "horizonUrl" | "explorerTxBase">,
): Deployments {
  return {
    network: "testnet",
    ...base,
    accounts: { issuer: null, fund: null, bank: null, keeper: null },
    assets: {},
    vault: { wasmHash: null, testVaultId: null },
    updatedAt: new Date(0).toISOString(),
  };
}

/**
 * Merges what the bootstrap found into the existing file. A null or missing value in
 * `update` never erases a known one, so re-running the bootstrap keeps earlier proofs
 * and the values recorded for the contract pole.
 */
export function mergeDeployments(
  existing: Deployments,
  update: { accounts?: Partial<Deployments["accounts"]>; assets?: Deployments["assets"] },
  now: Date,
): Deployments {
  const accounts = { ...existing.accounts };
  for (const [role, value] of Object.entries(update.accounts ?? {}) as [keyof Deployments["accounts"], string | null][]) {
    if (value) accounts[role] = value;
  }
  const assets = { ...existing.assets };
  for (const [id, asset] of Object.entries(update.assets ?? {}) as [AssetId, DeployedAsset][]) {
    const previous = assets[id];
    // An earlier proof is kept only if it belongs to the same contract.
    const earlierProof = previous?.sac === asset.sac ? previous.sacDeployTx : null;
    assets[id] = { ...asset, sacDeployTx: asset.sacDeployTx ?? earlierProof };
  }
  return { ...existing, accounts, assets, updatedAt: now.toISOString() };
}

export function readDeployments(path: string, fallback: Deployments): Deployments {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8")) as Deployments;
}

export function writeDeployments(path: string, d: Deployments): void {
  writeFileSync(path, `${JSON.stringify(d, null, 2)}\n`);
}
