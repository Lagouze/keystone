import type { ActivityEvent } from '@keystone/shared'
import { cx } from './cx.ts'

/** Tells apart a local computation (grey) from a real Stellar Testnet transaction (blue). */
export function KindBadge({ kind }: { kind: ActivityEvent['kind'] }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[0.625rem] font-medium tracking-wide',
        kind === 'chain' ? 'bg-chain-soft text-chain' : 'bg-surface-muted text-ink-subtle',
      )}
    >
      {kind === 'chain' ? 'On-chain' : 'Sim'}
    </span>
  )
}
