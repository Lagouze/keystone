import type { ActivityEvent } from '@keystone/shared'
import { cx } from './cx.ts'

/** Tells apart a local computation (violet) from a real Stellar Testnet transaction (blue). */
export function KindBadge({ kind }: { kind: ActivityEvent['kind'] }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-tag px-2 py-0.5 text-[0.625rem] font-medium tracking-wider',
        kind === 'chain' ? 'bg-chain-soft text-chain' : 'bg-sim-soft text-sim',
      )}
    >
      {kind === 'chain' ? 'TESTNET' : 'SIM'}
    </span>
  )
}
