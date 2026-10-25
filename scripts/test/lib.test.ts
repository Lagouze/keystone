// Unit tests of the pure helpers used by init-env and the Testnet bootstrap.
import { describe, expect, it } from "vitest";
import { fromSmallest, toSmallest } from "../lib/amounts.ts";
import { emptyDeployments, mergeDeployments } from "../lib/deployments.ts";
import { fillEmptyEnv, readEnvValue } from "../lib/env.ts";
import { ASSET_CODES, TESTNET } from "../lib/stellar.ts";

describe("env helpers", () => {
  const example = [
    "# comment",
    "ISSUER_SECRET=          # issuer",
    "FUND_SECRET=            # fund",
    "BANK_SECRET=SALREADYSET   # bank",
    "SIGNER=freighter        # freighter | keeper",
    "",
  ].join("\n");

  it("reads empty, set and missing keys", () => {
    expect(readEnvValue(example, "ISSUER_SECRET")).toBe("");
    expect(readEnvValue(example, "BANK_SECRET")).toBe("SALREADYSET");
    expect(readEnvValue(example, "SIGNER")).toBe("freighter");
    expect(readEnvValue(example, "KEEPER_SECRET")).toBeUndefined();
  });

  it("fills only empty keys, keeps comments, never overwrites, appends missing keys", () => {
    const { content, written } = fillEmptyEnv(example, { ISSUER_SECRET: "SNEW1", BANK_SECRET: "SNEW2", KEEPER_SECRET: "SNEW3" });
    expect(written.sort()).toEqual(["ISSUER_SECRET", "KEEPER_SECRET"]);
    expect(readEnvValue(content, "ISSUER_SECRET")).toBe("SNEW1");
    expect(readEnvValue(content, "BANK_SECRET")).toBe("SALREADYSET");
    expect(readEnvValue(content, "KEEPER_SECRET")).toBe("SNEW3");
    expect(readEnvValue(content, "FUND_SECRET")).toBe("");
    expect(content).toContain("# issuer");
    expect(content.endsWith("\n")).toBe(true);
  });

  it("reads spaced, exported and CRLF lines", () => {
    const content = "A = one   # c\r\nexport B=two\r\nC=\r\nD=   # empty\r\n";
    expect(readEnvValue(content, "A")).toBe("one");
    expect(readEnvValue(content, "B")).toBe("two");
    expect(readEnvValue(content, "C")).toBe("");
    expect(readEnvValue(content, "D")).toBe("");
  });

  it("does not add a second definition of a key already set with spaces", () => {
    const { written } = fillEmptyEnv("ISSUER_SECRET = SSET   # issuer\n", { ISSUER_SECRET: "SNEW" });
    expect(written).toEqual([]);
  });

  it("keeps CRLF line endings when filling a key", () => {
    const { content } = fillEmptyEnv("ISSUER_SECRET=   # issuer\r\nSIGNER=keeper\r\n", { ISSUER_SECRET: "SNEW" });
    expect(content).toBe("ISSUER_SECRET=SNEW   # issuer\r\nSIGNER=keeper\r\n");
  });

  it("refuses to guess when a line defining a key cannot be parsed", () => {
    expect(() => fillEmptyEnv("issuer ISSUER_SECRET: SX\n", { ISSUER_SECRET: "SNEW" })).toThrow(/ISSUER_SECRET/);
  });

  it("is idempotent", () => {
    const once = fillEmptyEnv(example, { ISSUER_SECRET: "SNEW1" }).content;
    const twice = fillEmptyEnv(once, { ISSUER_SECRET: "SOTHER" });
    expect(twice.written).toEqual([]);
    expect(twice.content).toBe(once);
  });
});

describe("amounts", () => {
  it("converts classic amounts exactly", () => {
    expect(toSmallest("1000")).toBe(10_000_000_000n);
    expect(toSmallest("1000.0000000")).toBe(10_000_000_000n);
    expect(toSmallest("0.0000001")).toBe(1n);
    expect(fromSmallest(10_000_000_000n - 1n)).toBe("999.9999999");
    expect(fromSmallest(5n)).toBe("0.0000005");
  });

  it("rejects malformed amounts", () => {
    expect(() => toSmallest("1.00000001")).toThrow();
    expect(() => toSmallest("-1")).toThrow();
    expect(() => fromSmallest(-1n)).toThrow();
  });
});

describe("deployments", () => {
  const base = emptyDeployments(TESTNET);
  const asset = { code: "KMMF", issuer: "GISSUER", sac: "CSAC", sacDeployTx: "HASH1" };

  it("keeps known values and proofs when a re-run finds nothing new", () => {
    const first = mergeDeployments(base, { accounts: { issuer: "GISSUER", fund: null }, assets: { KMMF: asset } }, new Date(1));
    const second = mergeDeployments(
      { ...first, vault: { wasmHash: "WASM", testVaultId: "CVAULT" }, accounts: { ...first.accounts, fund: "GFUND" } },
      { accounts: { issuer: "GISSUER", fund: null }, assets: { KMMF: { ...asset, sacDeployTx: null } } },
      new Date(2),
    );
    expect(second.assets.KMMF?.sacDeployTx).toBe("HASH1");
    expect(second.accounts.fund).toBe("GFUND");
    expect(second.vault).toEqual({ wasmHash: "WASM", testVaultId: "CVAULT" });
    expect(second.updatedAt).toBe(new Date(2).toISOString());
  });

  it("does not attach an earlier proof to a different contract", () => {
    const first = mergeDeployments(base, { assets: { KMMF: asset } }, new Date(1));
    const moved = mergeDeployments(first, { assets: { KMMF: { ...asset, sac: "COTHER", sacDeployTx: null } } }, new Date(2));
    expect(moved.assets.KMMF?.sacDeployTx).toBeNull();
  });

  it("never stores a secret-looking value in the public file", () => {
    const d = mergeDeployments(base, { accounts: { issuer: "GISSUER" }, assets: { KMMF: asset } }, new Date(1));
    expect(JSON.stringify(d)).not.toMatch(/"S[A-Z2-7]{55}"/);
  });
});

describe("Testnet constants", () => {
  it("match docs/interfaces.md sections 1 and 2", () => {
    expect(TESTNET.networkPassphrase).toBe("Test SDF Network ; September 2015");
    expect(TESTNET.rpcUrl).toBe("https://soroban-testnet.stellar.org");
    expect(ASSET_CODES).toEqual({ KMMF: "KMMF", KBOND: "KBOND" });
  });
});
