// In-memory VaultClient: the rules of docs/interfaces.md sections 3.2 to 3.6, without any network.
// Hashes and vault IDs are visibly fake. Used until the real client is wired, and by the tests.
import { randomBytes } from "node:crypto";
import { KeeperError, VaultError } from "./errors.ts";
import type {
  DeployParams, SignedTxInfo, TxResult, VaultClient, VaultEvent, VaultState,
} from "./vault-client.ts";

const I128_MAX = (1n << 127n) - 1n;

interface FakeVault {
  state: VaultState;
  fundBalance: bigint;
  bankBalance: bigint;
}

export interface FakeOptions {
  now?: () => bigint;            // ledger time, seconds
  fundInitialUnits?: bigint;     // tokens held by the fund outside the vault
}

export class FakeVaultClient implements VaultClient {
  private readonly vaults = new Map<string, FakeVault>();
  private readonly now: () => bigint;
  private readonly fundInitial: bigint;
  private counter = 0;

  constructor(opts: FakeOptions = {}) {
    this.now = opts.now ?? (() => BigInt(Math.floor(Date.now() / 1000)));
    this.fundInitial = opts.fundInitialUnits ?? 10_000_000_000n; // 1 000 units, like the bootstrap
  }

  async ledgerTime(): Promise<bigint> {
    return this.now();
  }

  async deploy(p: DeployParams): Promise<{ vaultId: string; txHash: string }> {
    const vaultId = `FAKEVAULT${String(++this.counter).padStart(4, "0")}`;
    this.vaults.set(vaultId, {
      fundBalance: this.fundInitial,
      bankBalance: 0n,
      state: {
        fund: p.fund, bank: p.bank, keeper: p.keeper, asset: p.assetSac,
        available: 0n, locked: 0n, required: 0n, shortfall: 0n,
        status: "Active", epoch: 0n, callDeadline: 0n,
        gracePeriodSecs: p.gracePeriodSecs, maxRequired: p.maxRequired,
      },
    });
    return { vaultId, txHash: this.fakeHash() };
  }

  async getState(vaultId: string): Promise<VaultState> {
    return { ...this.vault(vaultId).state };
  }

  async balances(vaultId: string): Promise<{ fund: bigint; bank: bigint }> {
    const v = this.vault(vaultId);
    return { fund: v.fundBalance, bank: v.bankBalance };
  }

  async deposit(vaultId: string, units: bigint): Promise<TxResult> {
    const v = this.vault(vaultId);
    if (units <= 0n || units > I128_MAX) throw new VaultError("InvalidAmount");
    if (v.state.status === "Defaulted") throw new VaultError("Defaulted");
    if (v.fundBalance < units) throw new KeeperError("TxFailed", "The fund does not hold enough tokens (SAC transfer failed)");
    v.fundBalance -= units;
    v.state.available += units;
    const events: VaultEvent[] = [{ type: "deposited", amount: units }];
    this.rebalance(v, events);
    return this.result(v, events);
  }

  async withdraw(vaultId: string, units: bigint): Promise<TxResult> {
    const v = this.vault(vaultId);
    if (units <= 0n || units > I128_MAX) throw new VaultError("InvalidAmount");
    if (units > v.state.available) throw new VaultError("InsufficientAvailable");
    v.state.available -= units;
    v.fundBalance += units;
    const events: VaultEvent[] = [{ type: "withdrawn", amount: units }];
    if (v.state.status !== "Defaulted") this.rebalance(v, events);
    return this.result(v, events);
  }

  async postMargin(vaultId: string, epoch: bigint, required: bigint): Promise<TxResult> {
    const v = this.vault(vaultId);
    if (v.state.status === "Defaulted") throw new VaultError("Defaulted");
    if (epoch <= v.state.epoch) throw new VaultError("StaleEpoch");
    if (required < 0n) throw new VaultError("InvalidAmount");
    if (required > v.state.maxRequired) throw new VaultError("AboveCap");
    v.state.epoch = epoch;
    v.state.required = required;
    const events: VaultEvent[] = [];
    this.rebalance(v, events, true);
    return this.result(v, events);
  }

  async settleDefault(vaultId: string): Promise<TxResult> {
    const v = this.vault(vaultId);
    const s = v.state;
    if (s.status === "Defaulted") throw new VaultError("Defaulted");
    if (s.status !== "MarginCall") throw new VaultError("NotInMarginCall");
    if (this.now() < s.callDeadline) throw new VaultError("GracePeriodRunning");
    if (s.shortfall <= 0n) throw new VaultError("NoShortfall");
    const amount = s.locked;
    v.bankBalance += amount;
    s.locked = 0n; s.required = 0n; s.shortfall = 0n; s.callDeadline = 0n;
    s.status = "Defaulted";
    return this.result(v, [{ type: "defaulted", amount }]);
  }

  async prepare(vaultId: string, action: "deposit" | "withdraw", units: bigint): Promise<string> {
    this.vault(vaultId);
    if (units <= 0n) throw new VaultError("InvalidAmount");
    return `FAKEXDR:${action}:${vaultId}:${units}`;
  }

  inspectSigned(signedTxXdr: string): SignedTxInfo {
    const m = /^FAKEXDR:(deposit|withdraw):([^:]+):(\d+)$/.exec(signedTxXdr);
    if (!m) throw new KeeperError("BadRequest", "signedTxXdr is not a transaction prepared by this keeper");
    return { action: m[1] as "deposit" | "withdraw", units: BigInt(m[3]!) };
  }

  async submitSigned(vaultId: string, signedTxXdr: string): Promise<TxResult> {
    const info = this.inspectSigned(signedTxXdr);
    if (signedTxXdr.split(":")[2] !== vaultId) throw new KeeperError("TxFailed", "The transaction targets another vault");
    return info.action === "deposit" ? this.deposit(vaultId, info.units) : this.withdraw(vaultId, info.units);
  }

  /** Section 3.3. `fromMargin` adds the `margin_set` event at the head of the list. */
  private rebalance(v: FakeVault, events: VaultEvent[], fromMargin = false): void {
    const s = v.state;
    const total = s.available + s.locked;
    s.locked = s.required < total ? s.required : total;
    s.available = total - s.locked;
    s.shortfall = s.required - s.locked;
    if (fromMargin) {
      events.push({ type: "margin_set", epoch: s.epoch, required: s.required, locked: s.locked, shortfall: s.shortfall });
    }
    if (s.shortfall > 0n && s.status === "Active") {
      s.status = "MarginCall";
      s.callDeadline = this.now() + s.gracePeriodSecs;
      events.push({ type: "margin_call", callDeadline: s.callDeadline });
    } else if (s.shortfall === 0n && s.status === "MarginCall") {
      s.status = "Active";
      s.callDeadline = 0n;
      events.push({ type: "cured" });
    }
  }

  private result(v: FakeVault, events: VaultEvent[]): TxResult {
    return { txHash: this.fakeHash(), events, state: { ...v.state } };
  }

  private fakeHash(): string {
    return `FAKE${randomBytes(30).toString("hex")}`;
  }

  private vault(id: string): FakeVault {
    const v = this.vaults.get(id);
    if (!v) throw new KeeperError("TxFailed", `Unknown vault ${id}`);
    return v;
  }
}
