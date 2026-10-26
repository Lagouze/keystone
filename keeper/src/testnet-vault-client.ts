// VaultClient on Stellar Testnet, built on the generated bindings of packages/vault-client (contract C1).
// `vault-client` re-exports the stellar-sdk it was generated with, so one SDK version is used throughout.
import {
  Address, Client as VaultBindings, contract, Contract, Keypair, nativeToScVal, rpc, scValToNative, TransactionBuilder,
  type xdr,
} from "vault-client";
import { CONTRACT_ERRORS, KeeperError, VaultError } from "./errors.ts";
import type {
  DeployParams, OnChainStatus, SignedTxInfo, TxResult, VaultClient, VaultEvent, VaultState,
} from "./vault-client.ts";

export interface TestnetOptions {
  rpcUrl: string;
  networkPassphrase: string;
  wasmHash: string;
  keeper: Keypair;
  /** Demo fund key: only needed for SIGNER=keeper (direct deposit / withdraw). */
  fundKeypair?: Keypair;
  /** Public address of the fund, used as the source of transactions prepared for the wallet. */
  fundAddress: string;
  confirmTimeoutSecs?: number;
}

/** Maps a thrown error to the API error model: contract rejection, RPC trouble, or other failure. */
export function mapChainError(e: unknown, vaultId?: string): KeeperError {
  if (e instanceof KeeperError) return e;
  const msg = e instanceof Error ? e.message : String(e);
  const code = /Error\(Contract, #(\d+)\)/.exec(msg)?.[1];
  const name = code ? CONTRACT_ERRORS[Number(code) - 1] : undefined;
  // The token contract numbers its errors too: when the message names other contracts and not the vault,
  // the code is not a vault code.
  const contracts: string[] = msg.match(/\bC[A-Z2-7]{55}\b/g) ?? [];
  const foreign = vaultId !== undefined && contracts.length > 0 && !contracts.includes(vaultId);
  if (name && !foreign) return new VaultError(name);
  if (/still pending|timed? ?out|timeout|ECONN|ENOTFOUND|fetch failed|socket hang up|\bHTTP (429|5\d\d)\b|\b(429|502|503|504)\b/i.test(msg)) {
    return new KeeperError("RpcUnavailable", `RPC unavailable or no confirmation: ${msg.slice(0, 200)}`);
  }
  return new KeeperError("TxFailed", msg.slice(0, 400));
}

/** Decodes one contract event (docs/interfaces.md section 3.5); unknown events are ignored. */
export function decodeEvent(topics: xdr.ScVal[], value: xdr.ScVal): VaultEvent | null {
  const name = topics.length === 1 ? scValToNative(topics[0]!) : null;
  const d = scValToNative(value) as Record<string, bigint | number> | null;
  switch (name) {
    case "deposited": return { type: "deposited", amount: BigInt(d!.amount!) };
    case "withdrawn": return { type: "withdrawn", amount: BigInt(d!.amount!) };
    case "margin_set":
      return { type: "margin_set", epoch: BigInt(d!.epoch!), required: BigInt(d!.required!), locked: BigInt(d!.locked!), shortfall: BigInt(d!.shortfall!) };
    case "margin_call": return { type: "margin_call", callDeadline: BigInt(d!.call_deadline!) };
    case "cured": return { type: "cured" };
    case "defaulted": return { type: "defaulted", amount: BigInt(d!.amount!) };
    default: return null;
  }
}

function toState(s: Awaited<ReturnType<VaultBindings["get_state"]>>["result"]): VaultState {
  return {
    fund: s.fund, bank: s.bank, keeper: s.keeper, asset: s.asset,
    available: BigInt(s.available), locked: BigInt(s.locked), required: BigInt(s.required), shortfall: BigInt(s.shortfall),
    status: s.status.tag as OnChainStatus,
    epoch: BigInt(s.epoch), callDeadline: BigInt(s.call_deadline),
    gracePeriodSecs: BigInt(s.grace_period_secs), maxRequired: BigInt(s.max_required),
  };
}

export class TestnetVaultClient implements VaultClient {
  private readonly o: TestnetOptions;
  private readonly server: rpc.Server;
  private readonly timeout: number;

  constructor(options: TestnetOptions) {
    this.o = options;
    this.server = new rpc.Server(options.rpcUrl);
    this.timeout = options.confirmTimeoutSecs ?? 60;
  }

  async ledgerTime(): Promise<bigint> {
    return this.guard(async () => {
      const latest = await this.server.getLatestLedger();
      const page = await this.server.getLedgers({ startLedger: latest.sequence, pagination: { limit: 1 } });
      return BigInt(page.ledgers[0]!.ledgerCloseTime);
    });
  }

  async deploy(p: DeployParams): Promise<{ vaultId: string; txHash: string }> {
    return this.guard(async () => {
      const tx = await VaultBindings.deploy(
        { fund: p.fund, bank: p.bank, keeper: p.keeper, asset: p.assetSac, max_required: p.maxRequired, grace_period_secs: p.gracePeriodSecs },
        { ...this.base(this.o.keeper), timeoutInSeconds: this.timeout, wasmHash: this.o.wasmHash, format: "hex" },
      );
      const sent = await tx.signAndSend();
      const vaultId = (sent.result as VaultBindings).options.contractId;
      return { vaultId, txHash: this.hashOf(sent) };
    });
  }

  async getState(vaultId: string): Promise<VaultState> {
    return this.guard(vaultId, async () => toState((await this.bindings(vaultId, this.o.keeper).get_state()).result));
  }

  async balances(vaultId: string): Promise<{ fund: bigint; bank: bigint }> {
    return this.guard(async () => {
      const s = await this.getState(vaultId);
      const [fund, bank] = await Promise.all([this.sacBalance(s.asset, s.fund), this.sacBalance(s.asset, s.bank)]);
      return { fund, bank };
    });
  }

  postMargin(vaultId: string, epoch: bigint, required: bigint): Promise<TxResult> {
    return this.write(vaultId, this.o.keeper, (c, o) => c.post_margin({ epoch, required }, o));
  }

  /** Permissionless: the keeper only pays the fee, no vault role authorizes the call (contract C2). */
  settleDefault(vaultId: string): Promise<TxResult> {
    return this.write(vaultId, this.o.keeper, (c, o) => c.settle_default(o));
  }

  deposit(vaultId: string, units: bigint): Promise<TxResult> {
    return this.write(vaultId, this.fundKey(), (c, o) => c.deposit({ amount: units }, o));
  }

  withdraw(vaultId: string, units: bigint): Promise<TxResult> {
    return this.write(vaultId, this.fundKey(), (c, o) => c.withdraw({ amount: units }, o));
  }

  async prepare(vaultId: string, action: "deposit" | "withdraw", units: bigint): Promise<string> {
    return this.guard(vaultId, async () => {
      // No signer: the transaction is simulated and assembled with the fund as source, and left unsigned.
      const client = new VaultBindings({
        contractId: vaultId, rpcUrl: this.o.rpcUrl, networkPassphrase: this.o.networkPassphrase,
        publicKey: this.o.fundAddress,
      });
      const tx = await client[action]({ amount: units }, { timeoutInSeconds: 180 });
      return tx.toXDR();
    });
  }

  inspectSigned(signedTxXdr: string): SignedTxInfo & { vaultId: string } {
    let tx;
    try {
      tx = TransactionBuilder.fromXDR(signedTxXdr, this.o.networkPassphrase);
    } catch {
      throw new KeeperError("BadRequest", "signedTxXdr is not a valid transaction envelope");
    }
    if ("innerTransaction" in tx) throw new KeeperError("BadRequest", "Fee-bump transactions are not accepted");
    const op = tx.operations[0] as { type: string; func?: xdr.HostFunction; source?: string } | undefined;
    if (tx.operations.length !== 1 || op?.type !== "invokeHostFunction" || !op.func || op.source) {
      throw new KeeperError("BadRequest", "The transaction must contain exactly one contract invocation, without operation source");
    }
    if (tx.source !== this.o.fundAddress) throw new KeeperError("BadRequest", "The transaction source must be the fund account");
    if (tx.signatures.length === 0) throw new KeeperError("BadRequest", "The transaction is not signed");
    try {
      if (op.func.switch().name !== "hostFunctionTypeInvokeContract") throw new Error("not an invocation");
      const call = op.func.invokeContract();
      const action = call.functionName().toString();
      const args = call.args();
      if ((action !== "deposit" && action !== "withdraw") || args.length !== 1 || args[0]!.switch().name !== "scvI128") {
        throw new Error("not a deposit or withdraw of an amount");
      }
      return { action, units: BigInt(scValToNative(args[0]!) as bigint), vaultId: Address.fromScAddress(call.contractAddress()).toString() };
    } catch {
      throw new KeeperError("BadRequest", "Only a deposit or withdraw of an i128 amount on the vault may be submitted");
    }
  }

  async submitSigned(vaultId: string, signedTxXdr: string): Promise<TxResult> {
    const info = this.inspectSigned(signedTxXdr);
    if (info.vaultId !== vaultId) throw new KeeperError("BadRequest", "The transaction targets another vault");
    return this.guard(vaultId, async () => {
      const tx = TransactionBuilder.fromXDR(signedTxXdr, this.o.networkPassphrase);
      const sent = await this.server.sendTransaction(tx);
      if (sent.status === "ERROR" || sent.status === "TRY_AGAIN_LATER") {
        throw new KeeperError(sent.status === "ERROR" ? "TxFailed" : "RpcUnavailable", `The network refused the transaction (${sent.status})`);
      }
      const res = await this.confirm(sent.hash);
      return { txHash: sent.hash, events: await this.eventsOf(vaultId, sent.hash, res.ledger), state: await this.getState(vaultId) };
    });
  }

  // ---- internals -------------------------------------------------------------------------

  private fundKey(): Keypair {
    if (!this.o.fundKeypair) throw new KeeperError("SignerModeDisabled", "No fund key configured: direct deposit and withdraw need SIGNER=keeper");
    return this.o.fundKeypair;
  }

  private base(kp: Keypair) {
    return {
      rpcUrl: this.o.rpcUrl, networkPassphrase: this.o.networkPassphrase, publicKey: kp.publicKey(),
      ...contract.basicNodeSigner(kp, this.o.networkPassphrase),
    };
  }

  private bindings(vaultId: string, kp: Keypair): VaultBindings {
    return new VaultBindings({ contractId: vaultId, ...this.base(kp) });
  }

  private async write(
    vaultId: string, signer: Keypair,
    call: (c: VaultBindings, opts: { timeoutInSeconds: number }) => ReturnType<VaultBindings["deposit"]>,
  ): Promise<TxResult> {
    return this.guard(vaultId, async () => {
      const tx = await call(this.bindings(vaultId, signer), { timeoutInSeconds: this.timeout });
      const sent = await tx.signAndSend();
      const txHash = this.hashOf(sent);
      const res = await this.confirm(txHash);
      // The transaction is confirmed: a failing event read must not turn it into an error.
      const events = await this.eventsOf(vaultId, txHash, res.ledger).catch(() => []);
      return { txHash, events, state: toState(sent.result) };
    });
  }

  private hashOf(sent: { sendTransactionResponse?: { hash: string } }): string {
    const hash = sent.sendTransactionResponse?.hash;
    if (!hash) throw new KeeperError("TxFailed", "The transaction was not submitted");
    return hash;
  }

  /** Waits for SUCCESS or FAILED; no answer within the timeout is RpcUnavailable. */
  private async confirm(hash: string): Promise<{ ledger: number }> {
    const res = await this.server.pollTransaction(hash, { attempts: Math.ceil(this.timeout / 2), sleepStrategy: () => 2000 });
    if (res.status === "SUCCESS") return { ledger: res.ledger };
    if (res.status === "FAILED") throw new KeeperError("TxFailed", `Transaction ${hash} failed on-chain`);
    throw new KeeperError("RpcUnavailable", `No confirmation for ${hash} after ${this.timeout}s`);
  }

  private async eventsOf(vaultId: string, hash: string, ledger: number): Promise<VaultEvent[]> {
    const page = await this.server.getEvents({
      startLedger: ledger, endLedger: ledger + 1, filters: [{ type: "contract", contractIds: [vaultId] }],
    } as never);
    return page.events
      .filter((e) => e.txHash === hash)
      .map((e) => decodeEvent(e.topic, e.value))
      .filter((e): e is VaultEvent => e !== null);
  }

  private async sacBalance(sac: string, holder: string): Promise<bigint> {
    const source = await this.server.getAccount(this.o.keeper.publicKey());
    const tx = new TransactionBuilder(source, { fee: "100", networkPassphrase: this.o.networkPassphrase })
      .addOperation(new Contract(sac).call("balance", nativeToScVal(new Address(holder), { type: "address" })))
      .setTimeout(60).build();
    const sim = await this.server.simulateTransaction(tx);
    if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) throw new KeeperError("TxFailed", `Cannot read the ${holder} balance`);
    return BigInt(scValToNative(sim.result.retval) as bigint);
  }

  private async guard<T>(vaultOrFn: string | (() => Promise<T>), maybeFn?: () => Promise<T>): Promise<T> {
    const vaultId = typeof vaultOrFn === "string" ? vaultOrFn : undefined;
    const fn = typeof vaultOrFn === "string" ? maybeFn! : vaultOrFn;
    try {
      return await fn();
    } catch (e) {
      throw mapChainError(e, vaultId);
    }
  }
}
