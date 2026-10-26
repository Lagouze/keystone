import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ActivityEvent, SessionState } from '@keystone/shared'
import { createMockClient, mockSigner } from '../src/api/mock.ts'
import type { KeeperClient } from '../src/api/client.ts'
import { proofOf } from '../src/lib/proof.ts'

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-26T10:00:00Z')); vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network forbidden in mock scenarios') })) })
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.useRealTimers(); vi.unstubAllGlobals() })
async function finish<T>(promise: Promise<T>): Promise<T> { await vi.runAllTimersAsync(); return promise }
async function move(client: KeeperClient, kind: 'deposit' | 'withdraw', units: string) {
  const config = await client.getConfig()
  return finish((async () => {
    const prepared = kind === 'deposit' ? await client.prepareDeposit(units) : await client.prepareWithdraw(units)
    return client.submit(await mockSigner(prepared.txXdr, config))
  })())
}
function conserved(state: SessionState) {
  const total = [state.balances.fundUnits, state.balances.bankUnits, state.vault.availableUnits, state.vault.lockedUnits].reduce((sum, value) => sum + BigInt(value), 0n)
  expect(total).toBe(1000n * 10n ** 7n)
}

it('plays KMMF deposit, two shocks, cure, release and withdrawal using the Freighter mock only', async () => {
  const client = createMockClient('freighter')
  const feed: ActivityEvent[] = []
  const stop = client.subscribe({ onActivity: (e) => feed.push(e), onState: conserved, onConnection: () => undefined })
  await finish(client.startSession('KMMF'))
  await move(client, 'deposit', '3000000000')
  const first = await finish(client.rateShock(-50))
  expect(first.vault.status).toBe('active'); expect(BigInt(first.vault.lockedUnits)).toBeGreaterThan(0n)
  const call = await finish(client.rateShock(-30))
  expect(call.vault.status).toBe('margin_call')
  const cured = await move(client, 'deposit', '1000000000')
  expect(cured.vault.status).toBe('active'); expect(cured.vault.callDeadline).toBeNull()
  const released = await finish(client.rateShock(60))
  expect(BigInt(released.vault.lockedUnits)).toBeLessThan(BigInt(cured.vault.lockedUnits))
  const withdrawn = await move(client, 'withdraw', released.vault.availableUnits)
  expect(withdrawn.vault.availableUnits).toBe('0'); conserved(withdrawn)
  expect(feed.some((e) => e.type === 'cured' && e.status === 'confirmed')).toBe(true)
  expect(feed.some((e) => e.type === 'released' && e.status === 'confirmed')).toBe(true)
  expect(feed.every((e) => proofOf(e, true) === null)).toBe(true)
  stop()
})

it('plays KBOND default with deadline refusal, exact settlement and terminal refusals entirely in mocks', async () => {
  const client = createMockClient('freighter')
  await finish(client.startSession('KBOND'))
  await move(client, 'deposit', '3000000000')
  const call = await finish(client.rateShock(-100))
  expect(call.vault.status).toBe('margin_call'); conserved(call)
  await expect(client.settleDefault()).rejects.toMatchObject({ code: 'GracePeriodRunning' })
  await vi.advanceTimersByTimeAsync(90_000)
  const settled = await finish(client.settleDefault())
  expect(settled.vault).toMatchObject({ status: 'defaulted', lockedUnits: '0', requiredUnits: '0', shortfallUnits: '0', callDeadline: null, epoch: call.vault.epoch })
  expect(settled.margin.requiredUnits).toBe(call.margin.requiredUnits)
  expect(settled.balances.bankUnits).toBe(call.vault.lockedUnits); conserved(settled)
  await expect(client.prepareDeposit('1')).rejects.toMatchObject({ code: 'Defaulted' })
  await expect(client.rateShock(-50)).rejects.toMatchObject({ code: 'Defaulted' })
  await expect(client.settleDefault()).rejects.toMatchObject({ code: 'NotInMarginCall' })
})
