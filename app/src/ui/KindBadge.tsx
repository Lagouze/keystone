import type { ActivityEvent } from '@keystone/shared'
import { entryKind } from '../lib/proof.ts'
import { cx } from './cx.ts'

/** Tells apart a local computation (Sim), a simulated transaction (Demo tx) and a real Stellar Testnet transaction (On-chain, blue). */
export function KindBadge({ event }: { event: ActivityEvent }) {
  const kind = entryKind(event)
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[0.625rem] font-medium tracking-wide',
        kind === 'real' ? 'bg-chain-soft text-chain' : 'bg-surface-muted text-ink-muted',
      )}
    >
      {kind === 'real' ? 'On-chain' : kind === 'demo' ? 'Demo tx' : 'Sim'}
    </span>
  )
}
