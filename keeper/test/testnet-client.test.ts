import { describe, expect, it } from "vitest";
import { Account, Contract, Keypair, Networks, nativeToScVal, Operation, TransactionBuilder, xdr } from "vault-client";
import { KeeperError, VaultError } from "../src/errors.ts";
import { TestnetVaultClient, classifySendError, decodeEvent, mapChainError } from "../src/testnet-vault-client.ts";
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

describe("SAC errors are not vault errors", () => {
  const VAULT = "CDL5GRMUQGDTCFVRKJPXKUUIXYLICZOPQP54WYODPGN2XLIVHKWGTQA2";
  const SAC = "CDB3KHRGMFXFRXEVVJUNUCDVPIR5RPKSSCTP5JUBK32F2ZMOZQVLMIA5";
  it("refuses to map a code when only another contract is named", () => {
    expect(mapChainError(new Error(`contract ${SAC} failed: Error(Contract, #4)`), VAULT).code).toBe("TxFailed");
    expect(mapChainError(new Error(`contract ${VAULT} failed: Error(Contract, #4)`), VAULT).code).toBe("AboveCap");
    expect(mapChainError(new Error("Error(Contract, #4)"), VAULT).code).toBe("AboveCap");
  });
});

describe("inspectSigned only accepts a signed deposit or withdraw on the vault", () => {
  const fund = Keypair.random();
  const VAULT = "CDL5GRMUQGDTCFVRKJPXKUUIXYLICZOPQP54WYODPGN2XLIVHKWGTQA2";
  const client = new TestnetVaultClient({
    rpcUrl: "https://rpc.invalid", networkPassphrase: Networks.TESTNET, wasmHash: "00", keeper: Keypair.random(), fundAddress: fund.publicKey(),
  });
  const build = (ops: xdr.Operation[], opts: { sign?: boolean; source?: string } = {}) => {
    const b = new TransactionBuilder(new Account(opts.source ?? fund.publicKey(), "1"), { fee: "100", networkPassphrase: Networks.TESTNET });
    ops.forEach((o) => b.addOperation(o));
    const tx = b.setTimeout(60).build();
    if (opts.sign !== false) tx.sign(fund);
    return tx.toXDR();
  };
  const call = (fn: string, ...args: xdr.ScVal[]) => new Contract(VAULT).call(fn, ...args);
  const amount = nativeToScVal(10000000n, { type: "i128" });
  const refused = (xdrString: string) => expect(() => client.inspectSigned(xdrString)).toThrow(KeeperError);
  const code = (xdrString: string) => { try { client.inspectSigned(xdrString); } catch (e) { return (e as KeeperError).code; } return null; };

  it("refuses a transaction that does not expire within the keeper's window", () => {
    const longLived = (secs: number | null) => {
      const b = new TransactionBuilder(new Account(fund.publicKey(), "1"), { fee: "100", networkPassphrase: Networks.TESTNET });
      b.addOperation(call("deposit", amount));
      const tx = secs === null ? b.setTimeout(0).build() : b.setTimeout(secs).build();
      tx.sign(fund);
      return tx.toXDR();
    };
    expect(code(longLived(3600))).toBe("BadRequest");
    expect(code(longLived(null))).toBe("BadRequest");
    expect(code(longLived(180))).toBeNull();
  });

  it("accepts a signed deposit and a withdraw", () => {
    expect(client.inspectSigned(build([call("deposit", amount)]))).toEqual({ action: "deposit", units: 10000000n, vaultId: VAULT, txHash: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(client.inspectSigned(build([call("withdraw", amount)])).action).toBe("withdraw");
  });
  it("refuses everything else with BadRequest", () => {
    for (const x of [
      build([call("deposit", amount)], { sign: false }),
      build([call("deposit", amount), call("deposit", amount)]),
      build([call("post_margin", amount)]),
      build([call("deposit")]),
      build([call("deposit", nativeToScVal("x", { type: "string" }))]),
      build([call("deposit", amount)], { source: Keypair.random().publicKey() }),
      build([Operation.bumpSequence({ bumpTo: "5" })]),
      "not xdr",
    ]) {
      expect(code(x)).toBe("BadRequest");
      refused(x);
    }
  });
  it("reports the vault so the caller can compare it", () => {
    const other = new Contract("CDB3KHRGMFXFRXEVVJUNUCDVPIR5RPKSSCTP5JUBK32F2ZMOZQVLMIA5").call("deposit", amount);
    expect(client.inspectSigned(build([other])).vaultId).not.toBe(VAULT);
  });
});

describe("classifySendError (keeper-signed sends)", () => {
  const HASH = "ab".repeat(32);
  class SendFailedError extends Error {}
  class TransactionStillPendingError extends Error {}

  it("does not treat DUPLICATE as a refusal", () => {
    const duplicate = new SendFailedError('Sending the transaction failed {\n "status": "DUPLICATE" }');
    const refused = new SendFailedError('Sending the transaction failed {\n "status": "TRY_AGAIN_LATER" }');
    expect(classifySendError(duplicate, HASH).notSent).toBeUndefined();
    expect(classifySendError(duplicate, HASH).txHash).toBe(HASH);
    expect(classifySendError(refused, HASH).notSent).toBe(true);
  });

  it("keeps the plain mapping when nothing was signed", () => {
    const e = classifySendError(new Error("Error(Contract, #2)"), undefined);
    expect(e.code).toBe("InsufficientAvailable");
    expect(e.txHash).toBeUndefined();
  });

  it("marks a refusal by the network as not sent", () => {
    const e = classifySendError(new SendFailedError('failed {"status": "ERROR"}'), HASH);
    expect(e.notSent).toBe(true);
    expect(e.txHash).toBeUndefined();
  });

  it("keeps the hash of a transaction whose confirmation was lost", () => {
    const e = classifySendError(new TransactionStillPendingError("Transaction still pending"), HASH, "CVAULT");
    expect([e.code, e.txHash, e.vaultId, e.notSent]).toEqual(["RpcUnavailable", HASH, "CVAULT", undefined]);
  });

  it("treats any other failure after signing as possibly in flight, even an unrecognised one", () => {
    for (const msg of ["getaddrinfo EAI_AGAIN soroban-testnet.stellar.org", "Network Error", "The operation was aborted", "weird failure"]) {
      const e = classifySendError(new Error(msg), HASH);
      expect([e.code, e.txHash], msg).toEqual(["RpcUnavailable", HASH]);
    }
  });
});

describe("send() reports the hash of what it sends, before sending", () => {
  const keeper = Keypair.random();
  const VAULT = "CDL5GRMUQGDTCFVRKJPXKUUIXYLICZOPQP54WYODPGN2XLIVHKWGTQA2";
  const client = new TestnetVaultClient({
    rpcUrl: "https://rpc.invalid", networkPassphrase: Networks.TESTNET, wasmHash: "00", keeper, fundAddress: Keypair.random().publicKey(),
  });
  const unsigned = () =>
    new TransactionBuilder(new Account(keeper.publicKey(), "1"), { fee: "100", networkPassphrase: Networks.TESTNET })
      .addOperation(new Contract(VAULT).call("settle_default")).setTimeout(60).build().toXDR();
  type Signer = (xdrString: string) => Promise<{ signedTxXdr: string }>;
  const send = (tx: unknown) => (client as unknown as { send(t: unknown, k: Keypair, v?: string): Promise<unknown> }).send(tx, keeper, VAULT);

  it("calls onSigned with the hash of the signed envelope, then lets the network step run", async () => {
    const order: string[] = [];
    let signedXdr = "";
    client.onSigned = (hash, vaultId) => { order.push(`hook:${hash}:${vaultId}`); };
    const tx = {
      signAndSend: async ({ signTransaction }: { signTransaction: Signer }) => {
        signedXdr = (await signTransaction(unsigned())).signedTxXdr;
        order.push("network");
        return "sent";
      },
    };
    await expect(send(tx)).resolves.toBe("sent");
    const expected = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET).hash().toString("hex");
    expect(order).toEqual([`hook:${expected}:${VAULT}`, "network"]);
  });

  it("turns a failure after signing into RpcUnavailable carrying that hash", async () => {
    let hook = "";
    client.onSigned = (h) => { hook = h; };
    const tx = { signAndSend: async ({ signTransaction }: { signTransaction: Signer }) => { await signTransaction(unsigned()); throw new Error("Request failed with status code 500"); } };
    const err = (await send(tx).catch((e: unknown) => e)) as { txHash: string };
    expect(err).toMatchObject({ code: "RpcUnavailable", vaultId: VAULT });
    expect(err.txHash).toMatch(/^[0-9a-f]{64}$/);
    expect(err.txHash).toBe(hook);
  });

  it("leaves a failure before signing as a plain error with no hash", async () => {
    client.onSigned = () => { throw new Error("must not be called"); };
    const tx = { signAndSend: async () => { throw new Error("Error(Contract, #2)"); } };
    await expect(send(tx)).rejects.toMatchObject({ code: "InsufficientAvailable", txHash: undefined });
  });
});
