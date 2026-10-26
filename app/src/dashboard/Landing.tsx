import { useRef, useState } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import type { AssetId, KeystoneConfig } from '@keystone/shared'
import { formatEur } from '../lib/format.ts'
import { Button, Card, Magnetic, SegmentedControl } from '../ui/index.ts'
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
  const heroBlur = useTransform(heroProgress, [0, 1], ['blur(0px)', 'blur(8px)'])

  // "Choose the collateral" arrives like a cloud: it grows, clears and sharpens as it is scrolled into view.
  const { scrollYProgress: cloudProgress } = useScroll({ target: start, offset: ['start 95%', 'start 70%'] })
  const cloudScale = useTransform(cloudProgress, [0, 1], [0.8, 1])
  const cloudOpacity = useTransform(cloudProgress, [0, 0.7], [0, 1])
  const cloudBlur = useTransform(cloudProgress, [0, 0.98, 1], ['blur(14px)', 'blur(0px)', 'none'])

  const story = useRef<HTMLElement>(null)
  const { scrollYProgress: storyProgress } = useScroll({ target: story, offset: ['start start', 'end end'] })

  return (
    <div>
      <section ref={hero} className="relative flex min-h-[88vh] items-center justify-center px-4">
        <motion.div style={still ? undefined : { scale: heroScale, opacity: heroOpacity, filter: heroBlur }} className="text-center">
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
              className="glass flex h-12 items-center gap-2 rounded-full px-6 text-sm font-medium text-ink shadow-card"
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
            <div className="glass gpu mx-auto hidden size-64 items-center justify-center rounded-full shadow-card md:flex" aria-hidden="true">
              <svg width="200" height="200" viewBox="0 0 200 200">
                <circle cx="100" cy="100" r="86" fill="none" strokeWidth="12" className="stroke-surface-muted" />
                <motion.circle
                  cx="100"
                  cy="100"
                  r="86"
                  fill="none"
                  strokeWidth="12"
                  strokeLinecap="round"
                  className="stroke-ink"
                  transform="rotate(-90 100 100)"
                  style={{ pathLength: still ? 1 : storyProgress }}
                />
              </svg>
            </div>
          </div>
        </div>
      </section>

      <Journey />
      <HowItWorks onStart={() => start.current?.scrollIntoView({ behavior: still ? 'auto' : 'smooth' })} />

      <section ref={start} className="scroll-mt-20 px-4 pt-[20vh] pb-32">
        <motion.div
          className="gpu mx-auto max-w-xl"
          style={still ? undefined : { scale: cloudScale, opacity: cloudOpacity, filter: cloudBlur }}
        >
          <Card title="Choose the collateral" description="Fictitious tokens, issued on Stellar Testnet.">
            <SegmentedControl
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
            <Button className="mt-6 w-full" variant="primary" busy={busy} onClick={() => onStart(asset)}>
              {busy ? 'Deploying the vault…' : 'Start'}
            </Button>
          </Card>
        </motion.div>
      </section>
    </div>
  )
}
