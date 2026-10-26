import type { ActivityEvent } from '@keystone/shared'

interface Proof {
  hash: string
  explorerUrl: string
}

/**
 * Proof of a Testnet transaction, following docs/interfaces.md section 5: only a confirmed
 * chain entry carrying both a hash and an explorer link has one. A sim entry never does.
 */
export function proofOf(event: ActivityEvent): Proof | null {
  if (event.kind !== 'chain' || event.status !== 'confirmed') return null
  if (!event.txHash || !event.explorerUrl) return null
  return { hash: event.txHash, explorerUrl: event.explorerUrl }
}

/**
 * Right-hand side of an activity entry: the abbreviated hash linking to stellar.expert when the
 * entry has a proof, otherwise its status. The only way the dashboard shows a hash.
 */
export function ActivityProof({ event }: { event: ActivityEvent }) {
  if (event.status === 'failed') {
    return <span className="text-xs font-medium text-danger">Failed</span>
  }
  if (event.status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
        <span
          aria-hidden="true"
          className="size-3 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin"
        />
        Pending
      </span>
    )
  }
  if (event.kind === 'sim') {
    return <span className="text-xs text-ink-subtle">No hash</span>
  }
  const proof = proofOf(event)
  if (!proof) {
    // A confirmed chain entry must carry a hash and a link (section 5): flag the keeper bug.
    console.warn('Confirmed chain entry without proof', event)
    return <span className="text-xs font-medium text-danger">Missing proof</span>
  }
  const short = proof.hash.length > 12 ? `${proof.hash.slice(0, 4)}…${proof.hash.slice(-4)}` : proof.hash
  return (
    <a
      href={proof.explorerUrl}
      target="_blank"
      rel="noreferrer"
      title={proof.hash}
      className="text-xs text-chain underline-offset-2 hover:text-chain-hover hover:underline"
    >
      {short}
      <span aria-hidden="true"> ↗</span>
      <span className="sr-only"> (opens stellar.expert)</span>
    </a>
  )
}
