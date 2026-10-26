import { useEffect, useRef, type RefObject } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { ActivityEvent } from '@keystone/shared'
import { formatTime } from '../lib/format.ts'
import { entryKind } from '../lib/proof.ts'
import { ActivityProof, Card, KindBadge } from '../ui/index.ts'

/**
 * Entries shrink and fade as they leave the visible part of the list (top or bottom), and sharpen as
 * they come in: the depth effect of the "Animated List" reference. One IntersectionObserver per row
 * writes a CSS variable, so scrolling never re-renders React.
 */
function useDepth(root: RefObject<HTMLElement | null>) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    const rootEl = root.current
    if (!el || !rootEl || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => el.style.setProperty('--vis', String(entry?.intersectionRatio ?? 1)), {
      root: rootEl,
      threshold: Array.from({ length: 11 }, (_, i) => i / 10),
    })
    io.observe(el)
    return () => io.disconnect()
  }, [root])
  return ref
}

function Row({ event, reveal, listRef }: { event: ActivityEvent; reveal: boolean; listRef: RefObject<HTMLElement | null> }) {
  const depth = useDepth(listRef)
  return (
    <motion.li
      layout
      // React Bits "Animated List": a new entry drops in from above on a spring, the others make room.
      initial={{ opacity: 0, y: -28, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      className="py-3.5"
    >
      <div
        ref={depth}
        className="grid grid-cols-[1fr_auto] items-start gap-x-3 gap-y-1 [opacity:calc(0.2+0.8*var(--vis,1))] [transform:scale(calc(0.92+0.08*var(--vis,1)))] [transition:opacity_.15s,transform_.15s]"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <KindBadge event={event} />
          <span className="text-sm text-ink">{event.title}</span>
        </div>
        <div className="pt-0.5 text-right">
          <ActivityProof event={event} reveal={reveal} />
        </div>
        <p className="col-span-2 text-xs text-ink-subtle">
          <time dateTime={event.ts}>{formatTime(event.ts)}</time>
          {event.detail && <> · {event.detail}</>}
        </p>
      </div>
    </motion.li>
  )
}

/** Every entry, newest first, in a list that scrolls inside the card so the column keeps its height. */
export function ActivityFeed({ activity }: { activity: ActivityEvent[] }) {
  // Entries seen pending in this browser session: their hash decrypts when they confirm. Entries
  // replayed already confirmed (reload, reconnection) show their hash plainly.
  const listRef = useRef<HTMLUListElement>(null)
  const seenPending = useRef(new Set<string>())
  for (const event of activity) {
    if (event.status === 'pending') seenPending.current.add(event.id)
  }

  return (
    <Card tone="bare" title="Activity" className="flex min-h-72 min-w-0 flex-1 flex-col lg:min-h-0">
      <p className="-mt-2 mb-2 text-xs text-ink-subtle">
        {activity.some((e) => entryKind(e) === 'demo')
          ? 'Sim = computation · Demo tx = simulated transaction, nothing sent to Stellar'
          : 'Sim = computation · On-chain = Testnet transaction'}
      </p>
      {activity.length === 0 ? (
        <p className="text-sm text-ink-subtle">Nothing yet.</p>
      ) : (
        <ul
          ref={listRef}
          tabIndex={0}
          role="region"
          aria-label="Activity, newest first"
          className="-mr-3 max-h-96 min-h-0 flex-1 divide-y divide-line-soft overflow-y-auto pr-3 [scrollbar-width:thin] focus-visible:outline-2 focus-visible:outline-chain lg:max-h-none"
        >
          <AnimatePresence initial={false}>
            {activity.map((event) => (
              <Row key={event.id} event={event} reveal={seenPending.current.has(event.id)} listRef={listRef} />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Card>
  )
}
