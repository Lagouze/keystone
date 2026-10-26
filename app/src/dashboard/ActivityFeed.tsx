import { useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { ActivityEvent } from '@keystone/shared'
import { formatTime } from '../lib/format.ts'
import { entryKind } from '../lib/proof.ts'
import { ActivityProof, Card, KindBadge } from '../ui/index.ts'

function Row({ event, reveal, detail }: { event: ActivityEvent; reveal: boolean; detail: boolean }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className="grid grid-cols-[1fr_auto] items-start gap-x-3 gap-y-1 py-3.5"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <KindBadge event={event} />
        <span className="text-sm text-ink">{event.title}</span>
      </div>
      <div className="pt-0.5 text-right">
        <ActivityProof event={event} reveal={reveal} />
      </div>
      {detail && (
        <p className="col-span-2 text-xs text-ink-subtle">
          <time dateTime={event.ts}>{formatTime(event.ts)}</time>
          {event.detail && <> · {event.detail}</>}
        </p>
      )}
    </motion.li>
  )
}

/** Every entry, newest first, in a list that scrolls inside the card so the column keeps its height. */
export function ActivityFeed({ activity }: { activity: ActivityEvent[] }) {
  // Entries seen pending in this browser session: their hash decrypts when they confirm. Entries
  // replayed already confirmed (reload, reconnection) show their hash plainly.
  const seenPending = useRef(new Set<string>())
  for (const event of activity) {
    if (event.status === 'pending') seenPending.current.add(event.id)
  }

  return (
    <Card title="Activity" className="flex min-h-72 min-w-0 flex-1 flex-col lg:min-h-0">
      <p className="-mt-2 mb-2 text-xs text-ink-subtle">
        {activity.some((e) => entryKind(e) === 'demo')
          ? 'Sim = computation · Demo tx = simulated transaction, nothing sent to Stellar'
          : 'Sim = computation · On-chain = Testnet transaction'}
      </p>
      {activity.length === 0 ? (
        <p className="text-sm text-ink-subtle">Nothing yet.</p>
      ) : (
        <ul
          tabIndex={0}
          role="region"
          aria-label="Activity, newest first"
          className="-mr-3 max-h-96 min-h-0 flex-1 divide-y divide-line-soft overflow-y-auto pr-3 [scrollbar-width:thin] focus-visible:outline-2 focus-visible:outline-chain lg:max-h-none"
        >
          <AnimatePresence initial={false}>
            {activity.map((event) => (
              <Row key={event.id} event={event} reveal={seenPending.current.has(event.id)} detail />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Card>
  )
}
