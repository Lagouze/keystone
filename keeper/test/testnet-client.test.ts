import { describe, expect, it } from "vitest";
import { nativeToScVal, xdr } from "vault-client";
import { KeeperError, VaultError } from "../src/errors.ts";
import { decodeEvent, mapChainError } from "../src/testnet-vault-client.ts";
import { isLocalOrigin } from "../src/server.ts";

const sym = (s: string) => xdr.ScVal.scvSymbol(s);

describe("mapChainError", () => {
  it("maps the contract error codes of docs/interfaces.md 3.6", () => {
    const names = ["InvalidAmount", "InsufficientAvailable", "StaleEpoch", "AboveCap", "NotInMarginCall", "GracePeriodRunning", "NoShortfall", "Defaulted"];
    names.forEach((name, i) => {
      const e = mapChainError(new Error(`HostError: Error(Contract, #${i + 1})\n diagnostic`));
      expect(e).toBeInstanceOf(VaultError);
      expect([e.code, e.httpStatus]).toEqual([name, 409]);
    });
  });
  it("does not present authorization or SAC failures as vault errors", () => {
    const e = mapChainError(new Error("HostError: Error(Auth, InvalidAction)"));
    expect([e.code, e.httpStatus]).toEqual(["TxFailed", 502]);
    expect(mapChainError(new Error("Error(Contract, #99)")).code).toBe("TxFailed");
  });
  it("maps network trouble and missing confirmation to RpcUnavailable", () => {
    expect(mapChainError(new Error("fetch failed")).code).toBe("RpcUnavailable");
    expect(mapChainError(new Error("Transaction still pending after 60s")).httpStatus).toBe(503);
  });
  it("keeps a KeeperError as is", () => {
    const k = new KeeperError("BadRequest", "x");
    expect(mapChainError(k)).toBe(k);
  });
});

describe("decodeEvent", () => {
  const map = (o: Record<string, bigint>) => nativeToScVal(o, { type: Object.fromEntries(Object.keys(o).map((k) => [k, ["symbol", "i128"]])) as never });
  it("decodes the named-key payloads of section 3.5", () => {
    expect(decodeEvent([sym("deposited")], map({ amount: 10000000n }))).toEqual({ type: "deposited", amount: 10000000n });
    expect(decodeEvent([sym("cured")], xdr.ScVal.scvMap([]))).toEqual({ type: "cured" });
    expect(decodeEvent([sym("defaulted")], map({ amount: 5n }))).toEqual({ type: "defaulted", amount: 5n });
  });
  it("ignores unknown events and multi-topic events", () => {
    expect(decodeEvent([sym("something")], xdr.ScVal.scvMap([]))).toBeNull();
    expect(decodeEvent([sym("transfer"), sym("x")], xdr.ScVal.scvMap([]))).toBeNull();
  });
});

describe("CORS origin policy", () => {
  it("allows only local pages by default", () => {
    for (const o of ["http://localhost:5173", "http://127.0.0.1:3000", "https://localhost"]) expect(isLocalOrigin(o)).toBe(true);
    for (const o of ["https://evil.example", "http://localhost.evil.example", "http://127.0.0.1.evil.com"]) expect(isLocalOrigin(o)).toBe(false);
  });
});
