import { AnimatePresence, motion } from 'motion/react'
import type { ActivityEvent } from '@keystone/shared'
import { formatTime } from '../lib/format.ts'
import { ActivityProof, Card, KindBadge } from '../ui/index.ts'

export function ActivityFeed({ activity }: { activity: ActivityEvent[] }) {
  return (
    <Card
      title="Activity"
      description="SIM entries are computations. Every token movement is a Stellar Testnet transaction with its proof."
    >
      {activity.length === 0 ? (
        <p className="text-sm text-ink-subtle">Nothing yet.</p>
      ) : (
        <ul className="divide-y divide-line-soft" aria-live="polite">
          <AnimatePresence initial={false}>
            {activity.map((event) => (
              <motion.li
                key={event.id}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-[1fr_auto] items-start gap-x-3 gap-y-1 py-3"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <KindBadge kind={event.kind} />
                  <span className="text-sm text-ink">{event.title}</span>
                </div>
                <div className="pt-0.5 text-right">
                  <ActivityProof event={event} />
                </div>
                <p className="col-span-2 text-xs text-ink-subtle">
                  <time dateTime={event.ts}>{formatTime(event.ts)}</time>
                  {event.detail && <> · {event.detail}</>}
                </p>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Card>
  )
}
