import type { ActivityEvent } from '@keystone/shared'
import { entryKind } from '../lib/proof.ts'
import { cx } from './cx.ts'

/**
 * Says what an entry is, in plain letter-spaced type (no badge): a local computation (Sim), a
 * simulated transaction (Demo tx), a Testnet transaction not confirmed (Testnet tx: its status,
 * pending or failed, sits on the right), or a confirmed Stellar Testnet transaction (On-chain,
 * blue). "On-chain" is only ever shown for a confirmed entry carrying a genuine hash.
 */
export function KindBadge({ event }: { event: ActivityEvent }) {
  const kind = entryKind(event)
  const onChain = kind === 'real' && event.status === 'confirmed'
  return (
    <span
      className={cx(
        'text-[0.6875rem] font-medium uppercase tracking-[0.12em]',
        onChain ? 'text-chain' : 'text-ink-subtle',
      )}
    >
      {onChain
        ? 'On-chain'
        : kind === 'demo'
          ? 'Demo tx'
          : kind === 'sim'
            ? 'Sim'
            : 'Testnet tx'}
    </span>
  )
}
