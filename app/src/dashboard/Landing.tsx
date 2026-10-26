import { useRef, useState } from 'react'
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react'
import type { AssetId, KeystoneConfig } from '@keystone/shared'
import { formatEur } from '../lib/format.ts'
import { Button, Magnetic, SegmentedControl } from '../ui/index.ts'
import { BlurReveal } from '../ui/BlurReveal.tsx'
import { CylinderText } from '../ui/CylinderText.tsx'
import { GhostType } from '../ui/GhostType.tsx'
import { HowItWorks } from './HowItWorks.tsx'
import { Journey } from './Journey.tsx'
import { VaporText } from '../ui/VaporText.tsx'

// A module constant: VaporText restarts when its `words` prop changes identity.
const VAPOR_WORDS = ['Lock', 'Call', 'Settle'] as const

const STEPS = [
  { title: 'Lock', text: 'The fund posts tokens it already holds. The vault locks what the margin needs.' },
  { title: 'Call', text: 'Rates move against the fund. A margin call opens, with a deadline.' },
  { title: 'Settle', text: 'Not covered in time? The locked tokens go to the bank. Nothing more.' },
] as const

/** Three dots, one per beat of the story: the active one grows and darkens as Lock gives way to Call, then Settle. */
function StoryDots({ progress, still }: { progress: MotionValue<number>; still: boolean }) {
  const [active, setActive] = useState(0)
  useMotionValueEvent(progress, 'change', (v) => {
    const next = Math.min(STEPS.length - 1, Math.max(0, Math.floor((v - 0.08) / 0.84 * (STEPS.length - 1) + 0.5)))
    if (next !== active) setActive(next)
  })
  return (
    <div className="mx-auto flex items-center gap-8 md:flex-col md:gap-5" aria-hidden="true">
      {STEPS.map((step, i) => (
        <div key={step.title} className="flex flex-col items-center gap-2">
          <motion.span
            className="block rounded-full bg-ink"
            animate={{ width: i === active ? 18 : 8, height: i === active ? 18 : 8, opacity: i === active ? 1 : 0.22 }}
            transition={still ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 28 }}
          />
          <span className={`text-[0.6875rem] uppercase tracking-[0.14em] transition-opacity duration-300 ${i === active ? 'opacity-70' : 'opacity-0'}`}>{step.title}</span>
        </div>
      ))}
    </div>
  )
}

/** Apple-style arrival: a hero that recedes, a pinned story revealed by scrolling, then the start. */
export function Landing({
  config,
  busy,
  onStart,
}: {
  config: KeystoneConfig
  busy: boolean
  onStart(asset: AssetId): void
}) {
  const [asset, setAsset] = useState<AssetId>(config.assets[0]?.id ?? 'KMMF')
  // Scroll-linked styles ignore MotionConfig: with reduced motion, everything stays put.
  const still = useReducedMotion() ?? false
  const start = useRef<HTMLElement>(null)
  const info = config.assets.find((a) => a.id === asset)

  const hero = useRef<HTMLElement>(null)
  const { scrollYProgress: heroProgress } = useScroll({ target: hero, offset: ['start start', 'end start'] })
  const heroScale = useTransform(heroProgress, [0, 1], [1, 0.86])
  const heroOpacity = useTransform(heroProgress, [0, 0.8], [1, 0])

  // "Choose the collateral" grows with the scroll, from a small card to the width of the screen.
  // Transform and opacity only (no filter, no layout), so it stays on the compositor.
  const { scrollYProgress: cloudProgress } = useScroll({ target: start, offset: ['start 100%', 'start 12%'] })
  const cloudScale = useTransform(cloudProgress, [0, 1], [0.46, 1])
  const cloudOpacity = useTransform(cloudProgress, [0, 0.35], [0, 1])
  const cloudRadius = useTransform(cloudProgress, [0, 1], [56, 40])

  const story = useRef<HTMLElement>(null)
  const { scrollYProgress: storyProgress } = useScroll({ target: story, offset: ['start start', 'end end'] })

  return (
    <div>
      <section ref={hero} className="relative flex min-h-[88vh] items-center justify-center px-4">
        <motion.div style={still ? undefined : { scale: heroScale, opacity: heroOpacity }} className="text-center">
          <h1 className="text-6xl font-medium tracking-tight sm:text-8xl">
            <BlurReveal text="Post tokens," />
            <br />
            <BlurReveal text="not cash." delay={0.25} />
          </h1>
          {/* Vapor Type: the three beats of the story condense out of vapor, one after the other. */}
          <div className="mt-8 h-24" aria-label="Lock, Call, Settle">
            <VaporText words={VAPOR_WORDS} fontSize={64} holdMs={1300} />
          </div>
          {/* Ghost Type: the line writes itself, a grey completion is accepted with Tab. */}
          <p className="mx-auto mt-2 min-h-14 max-w-xl text-xl text-ink-muted">
            <GhostType typed="Margin calls, covered by" ghost=" the assets a fund already holds." tail=" On Stellar." />
          </p>
          <Magnetic className="mt-14">
            <motion.button
              type="button"
              className="glass-lite flex h-12 items-center gap-2 rounded-full px-6 text-sm font-medium text-ink shadow-card"
              whileTap={{ scale: 0.96 }}
              onClick={() => start.current?.scrollIntoView({ behavior: still ? 'auto' : 'smooth' })}
            >
              Skip to start
              <motion.span
                aria-hidden="true"
                animate={still ? undefined : { y: [0, 3, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              >
                ↓
              </motion.span>
            </motion.button>
          </Magnetic>
        </motion.div>
      </section>

      <section ref={story} className="relative h-[200vh] md:h-[260vh]">
        <div className="sticky top-0 flex min-h-screen items-center px-4">
          <div className="mx-auto grid w-full max-w-5xl items-center gap-12 md:grid-cols-[minmax(0,1fr)_280px]">
            <CylinderText lines={STEPS} progress={storyProgress} />
            <StoryDots progress={storyProgress} still={still} />
          </div>
        </div>
      </section>

      <Journey />
      <HowItWorks onStart={() => start.current?.scrollIntoView({ behavior: still ? 'auto' : 'smooth' })} />

      <section ref={start} className="scroll-mt-20 px-4 pt-[20vh] pb-32">
        <motion.div
          className="gpu glass mx-auto flex min-h-[72vh] max-w-6xl origin-center items-center justify-center shadow-card"
          style={still ? { borderRadius: 40 } : { scale: cloudScale, opacity: cloudOpacity, borderRadius: cloudRadius }}
        >
          <div className="w-full max-w-md px-6 py-14 text-center">
            <h2 className="label-caps">Choose the collateral</h2>
            <p className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">Which tokens will the fund post?</p>
            <p className="mt-2 text-sm text-ink-subtle">Fictitious tokens, issued on Stellar Testnet.</p>
            <SegmentedControl
              className="mt-8"
              label="Collateral asset"
              value={asset}
              onChange={setAsset}
              options={config.assets.map((a) => ({ value: a.id, label: a.code }))}
            />
            {info && (
              <p className="mt-4 text-sm text-ink-subtle">
                {info.label} · €{formatEur(info.unitPriceEur)} (simulated) · haircut {info.haircutPct}%
              </p>
            )}
            <Button className="mt-8 w-full" variant="primary" busy={busy} onClick={() => onStart(asset)}>
              {busy ? 'Deploying the vault…' : 'Start'}
            </Button>
          </div>
        </motion.div>
      </section>
    </div>
  )
}
