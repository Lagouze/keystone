import { motion, useReducedMotion } from 'motion/react'
import { Chapter, usePinned } from '../ui/Chapter.tsx'
import { Button, Magnetic } from '../ui/index.ts'

const STEPS = [
  { title: 'Choose the collateral', text: 'KMMF or KBOND: fictitious tokens issued on Stellar Testnet.' },
  { title: 'Deposit', text: 'The fund moves tokens into its own vault. Only the fund can take them back.' },
  { title: 'Move the rates', text: 'Simulated Euribor shocks change what the swap is worth and what the vault must hold.' },
  { title: 'Cover or settle', text: 'Top up before the deadline, or let the vault send the locked tokens to the bank.' },
] as const

/** "How it works": a title and a button on the left, four numbered steps on the right. */
export function HowItWorks({ onStart }: { onStart(): void }) {
  const still = useReducedMotion()
  // Pinned, the chapter itself brings the content in; otherwise each part rises into view.
  const quiet = still || usePinned()
  return (
    <Chapter labelledBy="how-title" follows>
      <div className="mx-auto grid max-w-5xl gap-14 md:grid-cols-2 md:items-center">
        <motion.div
          initial={quiet ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 id="how-title" className="title-section">
            How it works
          </h2>
          <p className="text-lead mt-6 max-w-sm text-ink-muted">Four steps from a deposit to a settled margin call. Nothing is hidden, everything is on-chain.</p>
          <Magnetic className="mt-10">
            <Button variant="primary" className="!h-12 !px-7 uppercase tracking-[0.14em]" onClick={onStart}>
              Get started
            </Button>
          </Magnetic>
        </motion.div>
        <ol className="grid gap-9">
          {STEPS.map((step, i) => (
            <motion.li
              key={step.title}
              className="flex gap-5"
              initial={quiet ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="glass flex size-12 shrink-0 items-center justify-center rounded-full text-lg font-medium shadow-card" aria-hidden="true">
                {i + 1}
              </span>
              <div>
                <h3 className="text-xl font-medium tracking-tight">{step.title}</h3>
                <p className="mt-1 text-ink-muted">{step.text}</p>
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </Chapter>
  )
}
