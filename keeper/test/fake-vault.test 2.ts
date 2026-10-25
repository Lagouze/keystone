import { describe, expect, it } from "vitest";
import { FakeVaultClient } from "../src/fake-vault-client.ts";
import { VaultError } from "../src/errors.ts";

const params = { fund: "GF", bank: "GB", keeper: "GK", assetSac: "CA", maxRequired: 5_000n, gracePeriodSecs: 90n };

async function setup(now = { t: 1000n }) {
  const c = new FakeVaultClient({ now: () => now.t, fundInitialUnits: 10_000n });
  const { vaultId } = await c.deploy(params);
  return { c, vaultId, now };
}

const failsWith = (p: Promise<unknown>, code: string) =>
  expect(p).rejects.toSatisfy((e: unknown) => e instanceof VaultError && e.code === code);

describe("FakeVaultClient follows docs/interfaces.md section 3", () => {
  it("keeps available + locked equal to what the fund deposited minus what it withdrew", async () => {
    const { c, vaultId } = await setup();
    await c.deposit(vaultId, 1000n);
    await c.postMargin(vaultId, 1n, 400n);
    await c.withdraw(vaultId, 100n);
    const s = await c.getState(vaultId);
    expect(s.available + s.locked).toBe(900n);
    expect(s).toMatchObject({ locked: 400n, available: 500n, shortfall: 0n, status: "Active" });
    const b = await c.balances(vaultId);
    expect(b.fund + s.available + s.locked).toBe(10_000n);
  });

  it("opens a margin call with a deadline, and a top-up cures it", async () => {
    const { c, vaultId, now } = await setup();
    await c.deposit(vaultId, 300n);
    const r = await c.postMargin(vaultId, 1n, 500n);
    expect(r.state).toMatchObject({ status: "MarginCall", locked: 300n, shortfall: 200n, callDeadline: now.t + 90n });
    expect(r.events.map((e) => e.type)).toEqual(["margin_set", "margin_call"]);
    const cured = await c.deposit(vaultId, 200n);
    expect(cured.state).toMatchObject({ status: "Active", shortfall: 0n, callDeadline: 0n });
    expect(cured.events.map((e) => e.type)).toEqual(["deposited", "cured"]);
  });

  it("a lower requirement releases collateral", async () => {
    const { c, vaultId } = await setup();
    await c.deposit(vaultId, 300n);
    await c.postMargin(vaultId, 1n, 250n);
    const r = await c.postMargin(vaultId, 2n, 100n);
    expect(r.state).toMatchObject({ locked: 100n, available: 200n });
  });

  it("a margin call does not move its deadline while the shortfall persists", async () => {
    const { c, vaultId, now } = await setup();
    await c.deposit(vaultId, 100n);
    await c.postMargin(vaultId, 1n, 500n);
    now.t += 30n;
    const r = await c.postMargin(vaultId, 2n, 600n);
    expect(r.state.callDeadline).toBe(1000n + 90n);
  });

  it("settles a default only after the deadline, moving the locked collateral to the bank", async () => {
    const { c, vaultId, now } = await setup();
    await c.deposit(vaultId, 300n);
    await c.postMargin(vaultId, 1n, 500n);
    await failsWith(c.settleDefault(vaultId), "GracePeriodRunning");
    now.t += 90n;
    const r = await c.settleDefault(vaultId);
    expect(r.events).toEqual([{ type: "defaulted", amount: 300n }]);
    expect(r.state).toMatchObject({ status: "Defaulted", locked: 0n, required: 0n, shortfall: 0n, epoch: 1n });
    expect((await c.balances(vaultId)).bank).toBe(300n);
    await failsWith(c.deposit(vaultId, 1n), "Defaulted");
    await failsWith(c.postMargin(vaultId, 2n, 1n), "Defaulted");
  });

  it("refuses settlement outside a margin call", async () => {
    const { c, vaultId } = await setup();
    await failsWith(c.settleDefault(vaultId), "NotInMarginCall");
  });

  it("returns the contract errors", async () => {
    const { c, vaultId } = await setup();
    await failsWith(c.deposit(vaultId, 0n), "InvalidAmount");
    await failsWith(c.withdraw(vaultId, 1n), "InsufficientAvailable");
    await c.postMargin(vaultId, 1n, 10n);
    await failsWith(c.postMargin(vaultId, 1n, 10n), "StaleEpoch");
    await failsWith(c.postMargin(vaultId, 2n, -1n), "InvalidAmount");
    await failsWith(c.postMargin(vaultId, 2n, 5_001n), "AboveCap");
  });

  it("reports a missing balance as a transaction failure, not a vault error", async () => {
    const { c, vaultId } = await setup();
    await expect(c.deposit(vaultId, 10_001n)).rejects.toMatchObject({ code: "TxFailed" });
  });
});
