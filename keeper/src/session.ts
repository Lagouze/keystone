// Session state, activity feed and the operations that drive the vault (docs/interfaces.md section 4).
// All write operations run one after the other: a transaction is confirmed before the next starts.
import { randomUUID } from "node:crypto";
import type { ActivityEvent, ActivityType, AssetId, KeystoneConfig, SessionState, VaultStatus } from "@keystone/shared";
import { formatCents, formatMilli, formatUnits, parseScaled } from "./amounts.ts";
import type { EuriborResult } from "./euribor.ts";
import { KeeperError, VaultError } from "./errors.ts";
import {
  collateralParams, computeMargin, fixedRateFromStart, MILLI_PER_BP, shouldPost,
  type CollateralParams, type MarginResult, type SwapParams,
} from "./margin.ts";
import type { ScenarioFile } from "./scenarios.ts";
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
}

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
}

export class SessionManager {
  private session: Session | null = null;
  private activities: ActivityEvent[] = [];
  private readonly listeners = new Set<(m: StreamMessage) => void>();
  private queue: Promise<unknown> = Promise.resolve();
  private seq = 0;
  private readonly deps: SessionDeps;
  private readonly now: () => Date;

  constructor(deps: SessionDeps) {
    this.deps = deps;
    this.now = deps.now ?? (() => new Date());
  }

  // ---- streaming -------------------------------------------------------------------------

  /** Messages to replay on a new SSE connection: the whole history, then the current state. */
  replay(): StreamMessage[] {
    const out: StreamMessage[] = this.activities.map((data) => ({ event: "activity", data: { ...data } }));
    if (this.session?.lastState) out.push({ event: "state", data: this.session.lastState });
    return out;
  }

  subscribe(listener: (m: StreamMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ---- reads -----------------------------------------------------------------------------

  async getState(): Promise<SessionState> {
    const s = this.require();
    const state = await this.buildState(s);
    s.lastState = state;
    return state;
  }

  // ---- writes ----------------------------------------------------------------------------

  start(asset: AssetId): Promise<SessionState> {
    return this.enqueue(async () => {
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
        lastPostedValueCents: 0n, lastState: null,
      };
      this.session = s;
      this.activities = [];
      const { accounts } = this.deps.config;
      const deployed = await this.chain(s, "session_started", "Deploying a new vault", async () => {
        const r = await this.deps.client.deploy({
          fund: accounts.fund, bank: accounts.bank, keeper: accounts.keeper, assetSac: info.sac,
          maxRequired: BigInt(scenario.csa.maxRequiredUnits), gracePeriodSecs: BigInt(scenario.csa.gracePeriodSecs),
        });
        return { ...r, events: [] as VaultEvent[] };
      }, (r) => ({ title: `Vault deployed for ${info.code}`, detail: `Vault ${r.vaultId}` })).catch((e) => {
        this.session = null; // no vault: nothing to operate on
        throw e;
      });
      s.vaultId = deployed.vaultId;
      return this.publishState(s);
    });
  }

  deposit(units: bigint): Promise<SessionState> {
    return this.enqueue(async () => {
      const s = this.require();
      await this.chain(s, "deposit", `Depositing ${this.amount(s, units)}`, () => this.deps.client.deposit(s.vaultId!, units),
        () => ({ title: `Deposit of ${this.amount(s, units)}` }));
      return this.publishState(s);
    });
  }

  withdraw(units: bigint): Promise<SessionState> {
    return this.enqueue(async () => {
      const s = this.require();
      await this.chain(s, "withdraw", `Withdrawing ${this.amount(s, units)}`, () => this.deps.client.withdraw(s.vaultId!, units),
        () => ({ title: `Withdrawal of ${this.amount(s, units)}` }));
      return this.publishState(s);
    });
  }

  prepare(action: "deposit" | "withdraw", units: bigint): Promise<string> {
    return this.enqueue(async () => this.deps.client.prepare(this.require().vaultId!, action, units));
  }

  submit(signedTxXdr: string): Promise<SessionState> {
    return this.enqueue(async () => {
      const s = this.require();
      const info = this.deps.client.inspectSigned(signedTxXdr);
      const label = info.action === "deposit" ? "Deposit" : "Withdrawal";
      await this.chain(s, info.action, `${label} of ${this.amount(s, info.units)} signed in the wallet`,
        () => this.deps.client.submitSigned(s.vaultId!, signedTxXdr),
        () => ({ title: `${label} of ${this.amount(s, info.units)}`, detail: "Signed by the fund in the wallet" }));
      return this.publishState(s);
    });
  }

  /**
   * Adds `bp` to the float rate, recomputes the requirement, and posts it when it moved by at least
   * the MTA. The rate change is kept even if the posting fails: a shock of 0 bp retries the posting.
   */
  rateShock(bp: number): Promise<SessionState> {
    return this.enqueue(async () => {
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
        );
        s.lastPostedValueCents = margin.requiredValueCents;
      }
      return this.publishState(s);
    });
  }

  settleDefault(): Promise<SessionState> {
    return this.enqueue(async () => {
      const s = this.require();
      await this.chain(s, "defaulted", "Settling the default", () => this.deps.client.settleDefault(s.vaultId!),
        (r) => {
          const paid = r.events.find((e) => e.type === "defaulted");
          return { title: `Default settled: ${formatUnits(paid?.type === "defaulted" ? paid.amount : 0n)} ${s.asset} transferred to the bank` };
        });
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
  ): Promise<T> {
    const entry = this.add(s, { kind: "chain", type, title: pendingTitle, status: "pending" });
    let result: T;
    try {
      result = await run();
    } catch (e) {
      if (e instanceof KeeperError && e.code === "RpcUnavailable") {
        this.update(entry, { detail: `No confirmation yet: ${e.message}` });
      } else {
        this.update(entry, { status: "failed", detail: e instanceof Error ? e.message : String(e) });
      }
      throw e;
    }
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

  private add(s: Session, e: Omit<ActivityEvent, "id" | "sessionId" | "ts">): ActivityEvent {
    const entry: ActivityEvent = { id: `${s.id}-${++this.seq}`, sessionId: s.id, ts: this.now().toISOString(), ...e };
    this.activities.push(entry);
    this.emit({ event: "activity", data: { ...entry } });
    return entry;
  }

  private update(entry: ActivityEvent, patch: Partial<ActivityEvent>): void {
    Object.assign(entry, patch);
    this.emit({ event: "activity", data: { ...entry } });
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

  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = this.queue.then(job);
    this.queue = run.catch(() => undefined);
    return run;
  }
}
