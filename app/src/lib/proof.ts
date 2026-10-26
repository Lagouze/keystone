import type { ActivityEvent } from '@keystone/shared'
import { USE_MOCKS } from '../config.ts'

/**
 * What an activity entry is, for display:
 * - `sim`: a local computation, never a hash;
 * - `real`: a Stellar Testnet transaction confirmed by the keeper, with a genuine hash and link;
 * - `demo`: a transaction of the mock keeper (`MOCK…`) or of the keeper's in-memory backend
 *   (`FAKE…`): nothing was sent to Stellar, so it never gets an explorer link.
 */
export type EntryKind = 'sim' | 'real' | 'demo'

/** A Stellar transaction hash is 64 hexadecimal characters; `MOCK…` and `FAKE…` hashes are not. */
export const isStellarHash = (hash: string): boolean => /^[0-9a-f]{64}$/i.test(hash)

export interface Proof {
  hash: string
  explorerUrl: string
}

/**
 * A proof exists only for a confirmed chain entry with a genuine hash and an https explorer link
 * ending with that hash, and never in mock mode (`mocks`).
 */
export function proofOf(event: ActivityEvent, mocks: boolean = USE_MOCKS): Proof | null {
  if (mocks || event.kind !== 'chain' || event.status !== 'confirmed') return null
  const { txHash, explorerUrl } = event
  if (!txHash || !explorerUrl || !isStellarHash(txHash)) return null
  if (!explorerUrl.startsWith('https://') || !explorerUrl.endsWith(txHash)) return null
  return { hash: txHash, explorerUrl }
}

export function entryKind(event: ActivityEvent, mocks: boolean = USE_MOCKS): EntryKind {
  if (event.kind === 'sim') return 'sim'
  if (mocks) return 'demo'
  // Pending or failed entries have no hash yet: they are real until a confirmed one proves otherwise.
  if (event.status !== 'confirmed') return 'real'
  return proofOf(event, mocks) ? 'real' : 'demo'
}
