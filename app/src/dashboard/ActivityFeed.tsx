import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { ActivityEvent } from '@keystone/shared'
import { formatTime } from '../lib/format.ts'
import { ActivityProof, Card, KindBadge } from '../ui/index.ts'
import { Modal } from '../ui/Modal.tsx'

const VISIBLE = 4

function Row({ event, reveal, detail }: { event: ActivityEvent; reveal: boolean; detail: boolean }) {
  return (
    <motion.li
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

/** The last few entries; the full history, with details, sits behind "See all". */
export function ActivityFeed({ activity }: { activity: ActivityEvent[] }) {
  const [open, setOpen] = useState(false)
  // Entries seen pending in this browser session: their hash decrypts when they confirm. Entries
  // replayed already confirmed (reload, reconnection) show their hash plainly.
  const seenPending = useRef(new Set<string>())
  for (const event of activity) {
    if (event.status === 'pending') seenPending.current.add(event.id)
  }

  return (
    <Card
      title="Activity"
      actions={
        activity.length > VISIBLE ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-ink-muted transition-colors hover:bg-black/10 focus-visible:outline-2 focus-visible:outline-chain"
          >
            See all {activity.length}
          </button>
        ) : undefined
      }
    >
      {activity.length === 0 ? (
        <p className="text-sm text-ink-subtle">Nothing yet.</p>
      ) : (
        <ul className="divide-y divide-line-soft" aria-live="polite">
          <AnimatePresence initial={false}>
            {activity.slice(0, VISIBLE).map((event) => (
              <Row key={event.id} event={event} reveal={seenPending.current.has(event.id)} detail={false} />
            ))}
          </AnimatePresence>
        </ul>
      )}
      <Modal open={open} title="Activity" onClose={() => setOpen(false)}>
        <ul className="divide-y divide-line-soft">
          {activity.map((event) => (
            <Row key={event.id} event={event} reveal={false} detail />
          ))}
        </ul>
      </Modal>
    </Card>
  )
}
