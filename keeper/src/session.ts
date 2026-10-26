// Session state, activity feed and the operations that drive the vault (docs/interfaces.md section 4).
// All write operations run one after the other: a transaction is confirmed before the next starts.
import { randomUUID } from "node:crypto";
import type { ActivityEvent, ActivityType, AssetId, KeystoneConfig, SessionState, VaultStatus } from "@keystone/shared";
import { formatCents, formatMilli, formatUnits, parseScaled } from "./amounts.ts";
import type { EuriborResult } from "./euribor.ts";
import { isVaultGone, KeeperError, VaultError } from "./errors.ts";
import {
  collateralParams, computeMargin, fixedRateFromStart, MILLI_PER_BP, shouldPost,
  type CollateralParams, type MarginResult, type SwapParams,
} from "./margin.ts";
import type { ScenarioFile } from "./scenarios.ts";
import type { SessionStore } from "./store.ts";
import type { OnChainStatus, TxResult, VaultClient, VaultEvent, VaultState } from "./vault-client.ts";

export type StreamMessage =
  | { event: "activity"; data: ActivityEvent }
  | { event: "state"; data: SessionState };

export interface SessionDeps {
  client: VaultClient;
  config: KeystoneConfig;
  scenario: ScenarioFile;
  euribor: () => Promise<EuriborResult>;
  now?: () => Date;
  /** Durable copy of the session (hosted keeper). Without it the session lives in memory only. */
  store?: SessionStore;
}

/**
 * A transaction that was sent but whose outcome is unknown (RPC timeout, restart). No new write runs
 * until it is looked up by hash and found confirmed, failed, or expired without being included.
 */
interface Unresolved {
  hash: string;
  entryId: string;
  kind: "deploy" | "write";
  /** Epoch ms after which a transaction still NOT_FOUND can no longer be included in a ledger. */
  notAfter: number;
  doneTitle: string;
  doneDetail?: string;
  vaultId?: string;                  // deploy: the vault created by the transaction
  postedValueCents?: bigint;         // margin: becomes lastPostedValueCents once confirmed
}

/** What `chain` needs to remember an unconfirmed transaction. */
interface Track {
  kind?: "deploy";
  preHash?: string;                  // hash known before sending (wallet-signed transactions)
  doneTitle: string;
  doneDetail?: string;
  postedValueCents?: bigint;
}

/** Margin of safety over the 180 s validity of a prepared transaction and the 60 s of a keeper-signed one. */
const EXPIRY_MS = 200_000;

const STATUS: Record<OnChainStatus, VaultStatus> = { Active: "active", MarginCall: "margin_call", Defaulted: "defaulted" };
const MAX_BP = 1000;

interface Session {
  id: string;
  asset: AssetId;
  vaultId: string | null;            // null while the vault is being deployed
  swap: SwapParams;
  collateral: CollateralParams;
  floatRateMilli: number;
  floatRateSource: "ecb" | "cache" | "scenario";
  margin: MarginResult;              // last computed requirement, frozen after a default
  lastPostedValueCents: bigint;
  lastState: SessionState | null;
  feed: ActivityEvent[];             // activity history of this session
}

export class SessionManager {
  private session: Session | null = null;
  private pendingDeploy: Session | null = null;   // session whose vault deployment is unconfirmed
  private unresolved: Unresolved | null = null;
  /** The write in progress: lets a hash reported by the client be recorded before the transaction is sent. */
  private active: { entry: ActivityEvent; track: Track } | null = null;
  private readonly listeners = new Set<(m: StreamMessage) => void>();
  private queue: Promise<unknown> = Promise.resolve();
  private seq = 0;
  private readonly deps: SessionDeps;
  private readonly now: () => Date;

  constructor(deps: SessionDeps) {
    this.deps = deps;
    this.now = deps.now ?? (() => new Date());
    deps.client.onSigned = (hash, vaultId) => this.noteSigned(hash, vaultId);
  }

  /** Resolves once the queued writes are done (used to stop cleanly on SIGTERM). */
  idle(): Promise<void> {
    return this.queue.then(() => undefined, () => undefined);
  }

  // ---- persistence and reconciliation ------------------------------------------------------

  /** Reloads the saved session after a restart and settles any transaction left unconfirmed. */
  async restore(): Promise<void> {
    const store = this.deps.store;
    const data = store?.load();
    if (!store || !data) return;
    this.seq = typeof data.seq === "number" ? data.seq : 0;
    this.session = (data.session as Session | null) ?? null;
    this.pendingDeploy = (data.pendingDeploy as Session | null) ?? null;
    this.unresolved = (data.unresolved as Unresolved | null) ?? null;
    // A restart can interrupt a write between its signature and its confirmation. Every persisted pending
    // chain entry is therefore treated as unconfirmed (by hash when it has one) until its window has passed.
    if (!this.unresolved) {
      const owner = this.pendingDeploy ?? this.session;
      const entry = owner?.feed.find((e) => e.kind === "chain" && e.status === "pending");
      if (owner && entry) {
        this.unresolved = {
          hash: entry.txHash ?? "", entryId: entry.id, kind: owner === this.pendingDeploy ? "deploy" : "write",
          notAfter: this.now().getTime() + EXPIRY_MS, doneTitle: entry.title,
        };
        this.persist();
      }
    }
    if (this.session) {
      try {
        await this.publishState(this.session);
      } catch (e) {
        // Only proof that the vault is gone (a Testnet reset) drops the session, keeping a copy. A network
        // trouble at start-up keeps it: the state is rebuilt on the next read.
        if (isVaultGone(e)) {
          store.backup("dropped");
          console.error(`Saved session dropped (a copy was kept): ${e instanceof Error ? e.message : String(e)}`);
          this.session = null;
          this.persist();
        }
      }
    }
    if (this.unresolved) await this.enqueue(() => this.reconcile()).catch(() => undefined);
  }

  /** Looks up the unconfirmed transaction (if any) every `intervalMs`, so the feed settles by itself. */
  startReconciler(intervalMs = 15_000): () => void {
    const timer = setInterval(() => {
      if (this.unresolved) void this.enqueue(() => this.reconcile()).catch(() => undefined);
    }, intervalMs);
    timer.unref();
    return () => clearInterval(timer);
  }

  /** Saves the session; false when a store is configured and the write failed. */
  private persist(): boolean {
    const strip = (s: Session | null) => (s ? { ...s, lastState: null } : null);
    return this.deps.store?.save({
      seq: this.seq, session: strip(this.session), pendingDeploy: strip(this.pendingDeploy), unresolved: this.unresolved,
    }) ?? true;
  }

  /**
   * Settles the unconfirmed transaction by hash. Throws PendingTransaction while it may still be
   * included, and RpcUnavailable when the network cannot be asked: a write never starts in that case.
   */
  private async reconcile(): Promise<void> {
    const u = this.unresolved;
    if (!u) return;
    const s = u.kind === "deploy" ? this.pendingDeploy : this.session;
    const entry = s?.feed.find((e) => e.id === u.entryId);
    // No hash: the restart hit before it was recorded. Nothing can be looked up, so wait out the window.
    const status = u.hash ? await this.deps.client.txStatus(u.hash) : "NOT_FOUND";
    if (status === "NOT_FOUND" && this.now().getTime() <= u.notAfter) {
      throw new KeeperError("PendingTransaction",
        `Transaction ${u.hash} was sent but is not confirmed yet. No new transaction starts until its outcome is known.`);
    }
    this.unresolved = null;
    if (status === "SUCCESS") {
      if (entry) {
        this.update(entry, {
          status: "confirmed", title: u.doneTitle, detail: u.doneDetail ?? "Confirmed after the keeper stopped waiting.",
          txHash: u.hash, explorerUrl: `${this.deps.config.explorerTxBase}${u.hash}`,
        });
      }
      if (s && u.kind === "deploy" && !u.vaultId) {
        // Confirmed, but the vault address was not recorded: it cannot be adopted, say so rather than guess.
        if (entry) this.update(entry, { detail: "Confirmed after a restart; the vault address was not recorded, start a new session." });
        this.pendingDeploy = null;
      } else if (s && u.kind === "deploy" && u.vaultId) {
        s.vaultId = u.vaultId;
        this.pendingDeploy = null;
        this.session = s;
        for (const e of s.feed) this.emit({ event: "activity", data: { ...e } }); // clients now know this session id
      } else if (s && u.postedValueCents !== undefined) {
        s.lastPostedValueCents = u.postedValueCents;
      }
      this.persist();
      if (s?.vaultId) await this.publishState(s).catch(() => undefined);
      return;
    }
    if (entry) {
      this.update(entry, {
        status: "failed",
        detail: status === "FAILED"
          ? `Transaction ${u.hash} failed on-chain.`
          : u.hash
            ? `Transaction ${u.hash} was not found by the network after its validity window: treated as not included. The vault state shown is read from the chain.`
            : "The keeper restarted before recording the outcome of this transaction. The vault state shown is read from the chain.",
      });
    }
    if (u.kind === "deploy") this.pendingDeploy = null;
    this.persist();
  }

  // ---- streaming -------------------------------------------------------------------------

  /** Messages to replay on a new SSE connection: the whole history, then the current state. */
  replay(): StreamMessage[] {
    const out: StreamMessage[] = (this.session?.feed ?? []).map((data) => ({ event: "activity", data: { ...data } }));
    if (this.session?.lastState) out.push({ event: "state", data: this.session.lastState });
    return out;
  }

  subscribe(listener: (m: StreamMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ---- reads -----------------------------------------------------------------------------

  async getState(): Promise<SessionState> {
    // Read only: the cached state of the stream is refreshed by the write operations.
    return this.buildState(this.require());
  }

  // ---- writes ----------------------------------------------------------------------------

  start(asset: AssetId): Promise<SessionState> {
    return this.exclusive(async () => {
      const info = this.deps.config.assets.find((a) => a.id === asset);
      if (!info) throw new KeeperError("BadRequest", `Unknown asset ${asset}`);
      const rate = await this.deps.euribor().catch((e: Error) => {
        throw new KeeperError("RpcUnavailable", e.message);
      });
      const { scenario } = this.deps;
      const params = scenario.assets[asset];
      const swap: SwapParams = {
        notionalEur: BigInt(scenario.swap.notionalEur),
        fixedRateMilli: fixedRateFromStart(rate.rateMilli),
        tenorYears: scenario.swap.tenorYears,
      };
      const collateral = collateralParams(scenario.csa.thresholdEur, params.unitPriceEur, params.haircutPct);
      const s: Session = {
        id: randomUUID(), asset, vaultId: null, swap, collateral,
        floatRateMilli: rate.rateMilli, floatRateSource: rate.source,
        margin: computeMargin(swap, rate.rateMilli, collateral),
        lastPostedValueCents: 0n, lastState: null, feed: [],
      };
      // The new session replaces the current one only once its vault is deployed.
      const { accounts } = this.deps.config;
      this.pendingDeploy = s;
      let deployed;
      try {
        deployed = await this.chain(s, "session_started", "Deploying a new vault", async () => {
          const r = await this.deps.client.deploy({
            fund: accounts.fund, bank: accounts.bank, keeper: accounts.keeper, assetSac: info.sac,
            maxRequired: BigInt(scenario.csa.maxRequiredUnits), gracePeriodSecs: BigInt(scenario.csa.gracePeriodSecs),
          });
          return { ...r, events: [] as VaultEvent[] };
        }, (r) => ({ title: `Vault deployed for ${info.code}`, detail: `Vault ${r.vaultId}` }), undefined,
        { kind: "deploy", doneTitle: `Vault deployed for ${info.code}` });
      } catch (e) {
        if (!this.unresolved) this.pendingDeploy = null; // a deployment that may still land stays tracked
        this.persist();
        throw e;
      }
      this.pendingDeploy = null;
      s.vaultId = deployed.vaultId;
      this.session = s;
      this.persist();
      for (const e of s.feed) this.emit({ event: "activity", data: { ...e } }); // clients now know this session id
      return this.publishState(s);
    });
  }

  deposit(units: bigint): Promise<SessionState> {
    return this.exclusive(async () => {
      const s = this.require();
      await this.chain(s, "deposit", `Depositing ${this.amount(s, units)}`, () => this.deps.client.deposit(s.vaultId!, units),
        () => ({ title: `Deposit of ${this.amount(s, units)}` }), undefined, { doneTitle: `Deposit of ${this.amount(s, units)}` });
      return this.publishState(s);
    });
  }

  withdraw(units: bigint): Promise<SessionState> {
    return this.exclusive(async () => {
      const s = this.require();
      await this.chain(s, "withdraw", `Withdrawing ${this.amount(s, units)}`, () => this.deps.client.withdraw(s.vaultId!, units),
        () => ({ title: `Withdrawal of ${this.amount(s, units)}` }), undefined, { doneTitle: `Withdrawal of ${this.amount(s, units)}` });
      return this.publishState(s);
    });
  }

  prepare(action: "deposit" | "withdraw", units: bigint): Promise<string> {
    return this.exclusive(async () => this.deps.client.prepare(this.require().vaultId!, action, units));
  }

  submit(signedTxXdr: string): Promise<SessionState> {
    return this.exclusive(async () => {
      const s = this.require();
      const info = this.deps.client.inspectSigned(signedTxXdr);
      const label = info.action === "deposit" ? "Deposit" : "Withdrawal";
      await this.chain(s, info.action, `${label} of ${this.amount(s, info.units)} signed in the wallet`,
        () => this.deps.client.submitSigned(s.vaultId!, signedTxXdr),
        () => ({ title: `${label} of ${this.amount(s, info.units)}`, detail: "Signed by the fund in the wallet" }), undefined,
        { preHash: info.txHash, doneTitle: `${label} of ${this.amount(s, info.units)}`, doneDetail: "Signed by the fund in the wallet" });
      return this.publishState(s);
    });
  }

  /**
   * Adds `bp` to the float rate, recomputes the requirement, and posts it when it moved by at least
   * the MTA. The rate change is kept even if the posting fails: a shock of 0 bp retries the posting.
   */
  rateShock(bp: number): Promise<SessionState> {
    return this.exclusive(async () => {
      const s = this.require();
      if (!Number.isInteger(bp) || Math.abs(bp) > MAX_BP) {
        throw new KeeperError("BadRequest", `bp must be an integer between -${MAX_BP} and ${MAX_BP}`);
      }
      const before = await this.deps.client.getState(s.vaultId!);
      if (before.status === "Defaulted") throw new VaultError("Defaulted", "The vault is defaulted: the margin is frozen");

      const previousMilli = s.floatRateMilli;
      let margin: MarginResult;
      try {
        margin = computeMargin(s.swap, previousMilli + bp * MILLI_PER_BP, s.collateral);
      } catch (e) {
        throw new KeeperError("BadRequest", (e as Error).message);
      }
      s.floatRateMilli = previousMilli + bp * MILLI_PER_BP;
      s.floatRateSource = "scenario";
      s.margin = margin;

      const post = shouldPost(s.lastPostedValueCents, margin.requiredValueCents, this.mtaCents());
      const sign = bp > 0 ? "+" : "";
      this.add(s, {
        kind: "sim", type: "rate_shock", status: "confirmed",
        title: `Rate shock ${sign}${bp} bp: Euribor 3M ${formatMilli(previousMilli)} % to ${formatMilli(s.floatRateMilli)} %`,
        detail: `Fund mark-to-market ${formatCents(margin.mtmFundCents)} EUR, required collateral value ${formatCents(margin.requiredValueCents)} EUR, ` +
          `${formatUnits(margin.requiredUnits)} ${s.asset}. ` +
          (post ? "Posting the requirement to the vault." : "Change below the MTA: no transaction sent."),
      });

      try {
        if (post) {
          const epoch = before.epoch + 1n;
          if (epoch > BigInt(Number.MAX_SAFE_INTEGER)) throw new KeeperError("InternalError", "epoch out of range");
          await this.chain(s, "margin_set", `Posting margin requirement (epoch ${epoch})`,
            () => this.deps.client.postMargin(s.vaultId!, epoch, margin.requiredUnits),
            (r) => ({
              title: `Margin requirement posted (epoch ${epoch}): ${formatUnits(margin.requiredUnits)} ${s.asset} required`,
              detail: `Locked ${formatUnits(r.state.locked)}, shortfall ${formatUnits(r.state.shortfall)} ${s.asset}`,
            }),
            before.locked,
            { doneTitle: `Margin requirement posted (epoch ${epoch}): ${formatUnits(margin.requiredUnits)} ${s.asset} required`, postedValueCents: margin.requiredValueCents },
          );
          s.lastPostedValueCents = margin.requiredValueCents;
          this.persist();
        }
      } catch (e) {
        // The new rate and requirement are kept: tell the stream, a 0 bp shock retries the posting.
        await this.publishState(s).catch(() => undefined);
        throw e;
      }
      return this.publishState(s);
    });
  }

  settleDefault(): Promise<SessionState> {
    return this.exclusive(async () => {
      const s = this.require();
      await this.chain(s, "defaulted", "Settling the default", () => this.deps.client.settleDefault(s.vaultId!),
        (r) => {
          const paid = r.events.find((e) => e.type === "defaulted");
          return { title: `Default settled: ${formatUnits(paid?.type === "defaulted" ? paid.amount : 0n)} ${s.asset} transferred to the bank` };
        }, undefined, { doneTitle: "Default settled" });
      return this.publishState(s);
    });
  }

  // ---- internals -------------------------------------------------------------------------

  /**
   * Runs one transaction with its feed entry: `pending` before, `confirmed` (hash and link) after,
   * or `failed`. Other events of the same transaction become their own entries with the same hash.
   * A missing confirmation (RpcUnavailable) leaves the entry `pending`.
   */
  private async chain<T extends { txHash: string; events?: VaultEvent[]; state?: VaultState }>(
    s: Session,
    type: ActivityType,
    pendingTitle: string,
    run: () => Promise<T>,
    done: (r: T) => { title: string; detail?: string },
    lockedBefore?: bigint,
    track?: Track,
  ): Promise<T> {
    const entry = this.add(s, {
      kind: "chain", type, title: pendingTitle, status: "pending",
      ...(track?.preHash ? { txHash: track.preHash, explorerUrl: `${this.deps.config.explorerTxBase}${track.preHash}` } : {}),
    });
    this.active = track ? { entry, track } : null;
    let result: T;
    try {
      // A hash known before sending (wallet-signed) is recorded before the network can lose track of the transaction.
      if (track?.preHash) this.markInFlight(entry, track, track.preHash);
      result = await run();
    } catch (e) {
      const known = e instanceof KeeperError ? e : undefined;
      if (!this.unresolved && known?.txHash && track && !known.notSent) this.markInFlight(entry, track, known.txHash, known.vaultId);
      // Definite outcomes only: refused by the network, failed on-chain, or rejected before anything was sent.
      const definite = !this.unresolved || known?.notSent || known?.onChain || known?.code === "BadRequest";
      if (definite) {
        this.unresolved = null;
        this.update(entry, { status: "failed", detail: e instanceof Error ? e.message : String(e) });
        throw e;
      }
      // Anything else after the hash was recorded leaves the transaction possibly in flight: it stays pending and
      // guarded until looked up by hash, whatever the error looks like.
      const hash = this.unresolved!.hash;
      const message = e instanceof Error ? e.message : String(e);
      this.update(entry, { detail: `No confirmation yet: ${message}`, txHash: hash, explorerUrl: `${this.deps.config.explorerTxBase}${hash}` });
      throw known?.code === "RpcUnavailable" ? e : new KeeperError("RpcUnavailable", `No confirmation yet: ${message}`.slice(0, 300));
    } finally {
      this.active = null;
    }
    this.unresolved = null;
    const link = { txHash: result.txHash, explorerUrl: `${this.deps.config.explorerTxBase}${result.txHash}` };
    this.update(entry, { status: "confirmed", ...done(result), ...link });
    const events = result.events ?? [];
    for (const ev of events) {
      if (ev.type === "margin_call") {
        this.add(s, { kind: "chain", type: "margin_call", status: "confirmed", ...link, title: "Margin call opened",
          detail: `Deadline ${new Date(Number(ev.callDeadline) * 1000).toISOString()}` });
      } else if (ev.type === "cured") {
        this.add(s, { kind: "chain", type: "cured", status: "confirmed", ...link, title: "Margin call cured" });
      } else if (ev.type === "margin_set" && lockedBefore !== undefined && ev.locked < lockedBefore) {
        this.add(s, { kind: "chain", type: "released", status: "confirmed", ...link,
          title: `Collateral released: ${formatUnits(lockedBefore - ev.locked)} ${s.asset}` });
      }
    }
    return result;
  }

  /** Records a transaction as possibly in flight (and saves it). */
  private markInFlight(entry: ActivityEvent, track: Track, hash: string, vaultId?: string): void {
    this.unresolved = {
      hash, entryId: entry.id, kind: track.kind ?? "write", notAfter: this.now().getTime() + EXPIRY_MS,
      doneTitle: track.doneTitle, doneDetail: track.doneDetail, vaultId, postedValueCents: track.postedValueCents,
    };
    // The record must be durable before the transaction leaves: otherwise a restart would forget it.
    if (!this.persist()) {
      this.unresolved = null;
      throw new KeeperError("InternalError", "The keeper cannot save its state: nothing was sent");
    }
  }

  /** The client signed a transaction and is about to send it: record its hash first. */
  private noteSigned(hash: string, vaultId?: string): void {
    if (!this.active || this.unresolved?.hash === hash) return;
    this.markInFlight(this.active.entry, this.active.track, hash, vaultId);
  }

  private add(s: Session, e: Omit<ActivityEvent, "id" | "sessionId" | "ts">): ActivityEvent {
    const entry: ActivityEvent = { id: `${s.id}-${++this.seq}`, sessionId: s.id, ts: this.now().toISOString(), ...e };
    s.feed.push(entry);
    this.emit({ event: "activity", data: { ...entry } });
    this.persist();
    return entry;
  }

  private update(entry: ActivityEvent, patch: Partial<ActivityEvent>): void {
    Object.assign(entry, patch);
    this.emit({ event: "activity", data: { ...entry } });
    this.persist();
  }

  private emit(m: StreamMessage): void {
    for (const l of this.listeners) l(m);
  }

  private async publishState(s: Session): Promise<SessionState> {
    const state = await this.buildState(s);
    s.lastState = state;
    this.emit({ event: "state", data: state });
    return state;
  }

  private async buildState(s: Session): Promise<SessionState> {
    const { client, scenario } = this.deps;
    const [v, bal] = await Promise.all([client.getState(s.vaultId!), client.balances(s.vaultId!)]);
    if (v.epoch > BigInt(Number.MAX_SAFE_INTEGER)) throw new KeeperError("InternalError", "epoch out of range");
    const asset = scenario.assets[s.asset];
    return {
      sessionId: s.id,
      asset: s.asset,
      vaultId: s.vaultId!,
      updatedAt: this.now().toISOString(),
      swap: {
        notionalEur: `${s.swap.notionalEur}.00`,
        fixedRatePct: formatMilli(s.swap.fixedRateMilli),
        floatRatePct: formatMilli(s.floatRateMilli),
        floatRateSource: s.floatRateSource,
        tenorYears: s.swap.tenorYears,
        direction: "fund_pays_fixed",
      },
      margin: {
        mtmFundEur: formatCents(s.margin.mtmFundCents),
        thresholdEur: formatCents(s.collateral.thresholdCents),
        mtaEur: formatCents(this.mtaCents()),
        requiredValueEur: formatCents(s.margin.requiredValueCents),
        unitPriceEur: asset.unitPriceEur,
        haircutPct: asset.haircutPct,
        requiredUnits: s.margin.requiredUnits.toString(),
      },
      vault: {
        availableUnits: v.available.toString(),
        lockedUnits: v.locked.toString(),
        requiredUnits: v.required.toString(),
        shortfallUnits: v.shortfall.toString(),
        status: STATUS[v.status],
        epoch: Number(v.epoch),
        callDeadline: v.status === "MarginCall" && v.callDeadline > 0n ? new Date(Number(v.callDeadline) * 1000).toISOString() : null,
      },
      balances: { fundUnits: bal.fund.toString(), bankUnits: bal.bank.toString() },
    };
  }

  private mtaCents(): bigint {
    return parseScaled(this.deps.scenario.csa.mtaEur, 2);
  }

  private amount(s: Session, units: bigint): string {
    return `${formatUnits(units)} ${s.asset}`;
  }

  private require(): Session {
    if (!this.session?.vaultId) throw new KeeperError("NoSession", "No active session: POST /session first");
    return this.session;
  }

  /** A write: runs in the queue, after the previous unconfirmed transaction (if any) has been settled. */
  private exclusive<T>(job: () => Promise<T>): Promise<T> {
    return this.enqueue(async () => {
      await this.reconcile();
      return job();
    });
  }

  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = this.queue.then(job);
    this.queue = run.catch(() => undefined);
    return run;
  }
}
