import type { ActivityEvent } from '@keystone/shared'
import { entryKind } from '../lib/proof.ts'
import { cx } from './cx.ts'

/**
 * Says what an entry is, in plain letter-spaced type (no badge): a local computation (Sim), a
 * simulated transaction (Demo tx) or a real Stellar Testnet transaction (On-chain, blue).
 */
export function KindBadge({ event }: { event: ActivityEvent }) {
  const kind = entryKind(event)
  return (
    <span
      className={cx(
        'text-[0.6875rem] font-medium uppercase tracking-[0.12em]',
        kind === 'real' ? 'text-chain' : 'text-ink-subtle',
      )}
    >
      {kind === 'real' ? 'On-chain' : kind === 'demo' ? 'Demo tx' : 'Sim'}
    </span>
  )
}
