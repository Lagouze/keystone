import { motion, useReducedMotion } from 'motion/react'

const CHECK = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="mt-0.5 shrink-0 text-ink">
    <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const MILESTONES = [
  {
    when: 'Lock',
    title: 'Post what you hold.',
    items: ['The fund deposits tokens it already holds', 'The vault locks only what the margin needs', 'No cash set aside'],
  },
  {
    when: 'Call',
    title: 'Rates move. The clock starts.',
    items: ['The keeper recomputes the requirement', 'A margin call opens with a 90 second deadline', 'Top up and the call is cured'],
  },
  {
    when: 'Settle',
    title: 'Not covered? The vault decides.',
    items: ['After the deadline anyone can settle', 'The locked tokens go to the bank, nothing more', 'Every step is a Stellar transaction'],
  },
] as const

/** "Here is what you get done in one session": a timeline of three moments and a checklist card under each. */
export function Journey() {
  const still = useReducedMotion()
  return (
    <section className="px-4 py-24" aria-labelledby="journey-title">
      <div className="mx-auto max-w-5xl">
        <motion.div
          className="text-center"
          initial={still ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="label-caps">One session</p>
          <h2 id="journey-title" className="mx-auto mt-3 max-w-3xl text-4xl font-medium tracking-tight sm:text-6xl">
            Here is what a margin call looks like on Stellar.
          </h2>
        </motion.div>

        <div className="relative mt-16 grid gap-6 md:grid-cols-3">
          {/* the timeline: a line and three points, drawn as the section arrives */}
          <div className="absolute inset-x-[16.6%] top-[3.05rem] hidden h-px md:block" aria-hidden="true">
            <motion.div
              className="h-px origin-left bg-ink/25"
              initial={still ? false : { scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, amount: 1 }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          {MILESTONES.map((m, i) => (
            <motion.article
              key={m.when}
              className="relative"
              initial={still ? false : { opacity: 0, y: 36 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.7, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="mb-6 flex flex-col items-center gap-3 max-md:hidden">
                <span className="glass-lite rounded-full px-4 py-1.5 text-sm font-medium">{m.when}</span>
                <span className="-mb-[3px] size-2.5 rounded-full border border-ink/40 bg-white/80" aria-hidden="true" />
              </div>
              <div className="glass h-full rounded-[2rem] p-7 shadow-card">
                <p className="label-caps md:hidden">{m.when}</p>
                <h3 className="mt-1 text-xl font-medium tracking-tight md:mt-0">{m.title}</h3>
                <ul className="mt-5 grid gap-3 text-[0.9375rem] text-ink-muted">
                  {m.items.map((item) => (
                    <li key={item} className="flex gap-2.5">
                      {CHECK}
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}
