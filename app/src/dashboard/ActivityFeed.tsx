import { useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { ActivityEvent } from '@keystone/shared'
import { formatTime } from '../lib/format.ts'
import GradualBlur from '../ui/bits/GradualBlur.tsx'
import { ActivityProof, Card, KindBadge } from '../ui/index.ts'

export function ActivityFeed({ activity }: { activity: ActivityEvent[] }) {
  // Entries seen pending in this browser session: their hash decrypts when they confirm. Entries
  // replayed already confirmed (reload, reconnection) show their hash plainly.
  const seenPending = useRef(new Set<string>())
  for (const event of activity) {
    if (event.status === 'pending') seenPending.current.add(event.id)
  }

  return (
    <Card
      title="Activity"
      description="SIM entries are computations. Every token movement is a Stellar Testnet transaction with its proof."
    >
      {activity.length === 0 ? (
        <p className="text-sm text-ink-subtle">Nothing yet.</p>
      ) : (
        <div className="relative">
          <ul className="max-h-[28rem] divide-y divide-line-soft overflow-y-auto pb-6" aria-live="polite">
            <AnimatePresence initial={false}>
              {activity.map((event) => (
                <motion.li
                  key={event.id}
                  layout
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                  className="grid grid-cols-[1fr_auto] items-start gap-x-3 gap-y-1 py-3"
                >
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <KindBadge kind={event.kind} />
                    <span className="text-sm text-ink">{event.title}</span>
                  </div>
                  <div className="pt-0.5 text-right">
                    <ActivityProof event={event} reveal={seenPending.current.has(event.id)} />
                  </div>
                  <p className="col-span-2 text-xs text-ink-subtle">
                    <time dateTime={event.ts}>{formatTime(event.ts)}</time>
                    {event.detail && <> · {event.detail}</>}
                  </p>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          <GradualBlur position="bottom" target="parent" height="3rem" strength={1.5} layers={6} zIndex={1} />
        </div>
      )}
    </Card>
  )
}
