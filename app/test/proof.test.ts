import { describe, expect, it } from 'vitest'
import type { ActivityEvent } from '@keystone/shared'
import { mockScenario1Activity as mockActivity } from '@keystone/shared/mocks'
import { entryKind, isStellarHash, proofOf } from '../src/lib/proof.ts'

const BASE = 'https://stellar.expert/explorer/testnet/tx/'
const REAL = 'a'.repeat(32) + '0123456789abcdef'.repeat(2)
const entry = (over: Partial<ActivityEvent>): ActivityEvent => ({
  id: 'e', sessionId: 's', ts: '2026-10-26T00:00:00.000Z', kind: 'chain', type: 'deposit', title: 't', status: 'confirmed',
  txHash: REAL, explorerUrl: BASE + REAL, ...over,
})

describe('a real Testnet transaction', () => {
  it('has a proof and is shown as on-chain', () => {
    const e = entry({})
    expect(isStellarHash(REAL)).toBe(true)
    expect(proofOf(e, false)).toEqual({ hash: REAL, explorerUrl: BASE + REAL })
    expect(entryKind(e, false)).toBe('real')
  })
  it('stays on-chain while pending or failed (no hash yet)', () => {
    expect(entryKind(entry({ status: 'pending', txHash: undefined, explorerUrl: undefined }), false)).toBe('real')
    expect(proofOf(entry({ status: 'pending' }), false)).toBeNull()
  })
})

describe('mock and fake hashes are never a proof', () => {
  it('MOCK hashes are demo transactions without a link, whatever the mode', () => {
    const e = entry({ txHash: 'MOCK0019' + '0'.repeat(56), explorerUrl: BASE + 'MOCK0019' + '0'.repeat(56) })
    for (const mocks of [true, false]) {
      expect(proofOf(e, mocks)).toBeNull()
      expect(entryKind(e, mocks)).toBe('demo')
    }
  })
  it('FAKE hashes of the keeper in-memory backend are demo transactions', () => {
    const hash = 'FAKE' + 'ab12'.repeat(15)
    expect(hash).toHaveLength(64)
    const e = entry({ txHash: hash, explorerUrl: BASE + hash })
    expect(isStellarHash(hash)).toBe(false)
    expect(proofOf(e, false)).toBeNull()
    expect(entryKind(e, false)).toBe('demo')
  })
  it('even a genuine-looking hash is a demo transaction in mock mode', () => {
    expect(proofOf(entry({}), true)).toBeNull()
    expect(entryKind(entry({}), true)).toBe('demo')
    expect(entryKind(entry({ status: 'pending', txHash: undefined, explorerUrl: undefined }), true)).toBe('demo')
  })
  it('refuses a link that does not end with the hash or is not https', () => {
    expect(proofOf(entry({ explorerUrl: BASE + 'b'.repeat(64) }), false)).toBeNull()
    expect(proofOf(entry({ explorerUrl: 'http://stellar.expert/tx/' + REAL }), false)).toBeNull()
    expect(proofOf(entry({ explorerUrl: undefined }), false)).toBeNull()
  })
  it('a confirmed chain entry without hash is not a real transaction', () => {
    expect(entryKind(entry({ txHash: undefined, explorerUrl: undefined }), false)).toBe('demo')
  })
})

describe('simulations', () => {
  it('a sim entry is never a transaction', () => {
    const e = entry({ kind: 'sim', type: 'rate_shock', txHash: undefined, explorerUrl: undefined })
    expect(entryKind(e, true)).toBe('sim')
    expect(entryKind(e, false)).toBe('sim')
    expect(proofOf(e, false)).toBeNull()
  })
})

describe('the shared mocks', () => {
  it('none of the mock chain entries can ever be shown as a real proof', () => {
    const chain = mockActivity.filter((e) => e.kind === 'chain')
    expect(chain.length).toBeGreaterThan(0)
    for (const e of chain) {
      expect(proofOf(e, false)).toBeNull()
      expect(entryKind(e, false)).toBe(e.status === 'confirmed' ? 'demo' : 'real')
    }
  })
})
