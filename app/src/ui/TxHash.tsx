import type { ActivityEvent } from '@keystone/shared'

interface TxHashProps {
  hash: string
  explorerUrl: string
}

/**
 * Proof of a Testnet transaction, following docs/interfaces.md section 5: only a confirmed
 * chain entry carrying both a hash and an explorer link has one. A sim entry never does.
 */
export function proofOf(event: ActivityEvent): TxHashProps | null {
  if (event.kind !== 'chain' || event.status !== 'confirmed') return null
  if (!event.txHash || !event.explorerUrl) return null
  return { hash: event.txHash, explorerUrl: event.explorerUrl }
}

/** Abbreviated transaction hash linking to stellar.expert. Feed it from `proofOf`. */
export function TxHash({ hash, explorerUrl }: TxHashProps) {
  const short = hash.length > 12 ? `${hash.slice(0, 4)}…${hash.slice(-4)}` : hash
  return (
    <a
      href={explorerUrl}
      target="_blank"
      rel="noreferrer"
      title={hash}
      className="font-mono text-xs text-accent underline-offset-2 hover:underline"
    >
      {short}
      <span aria-hidden="true"> ↗</span>
      <span className="sr-only"> (opens stellar.expert)</span>
    </a>
  )
}
