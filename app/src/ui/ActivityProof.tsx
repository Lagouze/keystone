import type { ActivityEvent } from '@keystone/shared'
import { entryKind, proofOf } from '../lib/proof.ts'
import { RevealHash, TxMark } from './motion.tsx'

/**
 * Right-hand side of an activity entry: the abbreviated hash linking to stellar.expert when the
 * entry has a proof, otherwise its status. The only way the dashboard shows a hash.
 * `reveal`: the entry was seen pending in this session, so its hash decrypts on confirmation.
 */
export function ActivityProof({ event, reveal = false }: { event: ActivityEvent; reveal?: boolean }) {
  if (event.status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-danger">
        <TxMark status="failed" />
        Failed
      </span>
    )
  }
  if (event.kind === 'sim') {
    return <span className="text-xs text-ink-subtle">No hash</span>
  }
  if (event.status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
        <TxMark status="pending" />
        Pending
      </span>
    )
  }
  if (entryKind(event) === 'demo') {
    // Mock or in-memory keeper: the hash is invented, nothing was sent to Stellar. No link.
    const shown = event.txHash && event.txHash.length > 12 ? `${event.txHash.slice(0, 4)}…${event.txHash.slice(-4)}` : (event.txHash ?? '')
    return (
      <span className="text-xs text-ink-subtle" title="Simulated transaction: nothing was sent to Stellar">
        Demo · <RevealHash text={shown} animate={reveal} />
      </span>
    )
  }
  const proof = proofOf(event)
  if (!proof) {
    // A confirmed chain entry must carry a hash and a link (section 5): flag the keeper bug.
    console.warn('Confirmed chain entry without proof', event)
    return <span className="text-xs font-medium text-danger">Missing proof</span>
  }
  const short = proof.hash.length > 12 ? `${proof.hash.slice(0, 4)}…${proof.hash.slice(-4)}` : proof.hash
  return (
    <span className="inline-flex items-center gap-1.5">
      <TxMark status="confirmed" />
      <a
        href={proof.explorerUrl}
        target="_blank"
        rel="noreferrer"
        title={proof.hash}
        className="text-xs text-chain underline-offset-2 hover:text-chain-hover hover:underline"
      >
        <RevealHash text={short} animate={reveal} />
        <span aria-hidden="true"> ↗</span>
        <span className="sr-only"> (opens stellar.expert)</span>
      </a>
    </span>
  )
}
