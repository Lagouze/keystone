import type { ActivityEvent } from '@keystone/shared'
import { cx } from './cx.ts'

/** Tells apart a local computation from a real Stellar Testnet transaction. */
export function KindBadge({ kind }: { kind: ActivityEvent['kind'] }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
        kind === 'chain' ? 'bg-accent-soft text-accent' : 'bg-surface-muted text-ink-muted',
      )}
    >
      {kind === 'chain' ? 'Testnet tx' : 'Simulation'}
    </span>
  )
}
