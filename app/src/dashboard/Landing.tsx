import { useRef, useState } from 'react'
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react'
import type { AssetId, KeystoneConfig } from '@keystone/shared'
import { formatEur } from '../lib/format.ts'
import { Button, Magnetic, SegmentedControl } from '../ui/index.ts'
import { BlurReveal } from '../ui/BlurReveal.tsx'
import { CylinderText } from '../ui/CylinderText.tsx'
import { GhostType } from '../ui/GhostType.tsx'
import { HowItWorks } from './HowItWorks.tsx'
import { Journey } from './Journey.tsx'
import { VaporText } from '../ui/VaporText.tsx'
import { usePinned } from '../ui/Chapter.tsx'
import { cx } from '../ui/cx.ts'

// A module constant: VaporText restarts when its `words` prop changes identity.
const VAPOR_WORDS = ['Lock', 'Call', 'Settle'] as const

const STEPS = [
  { title: 'Lock', text: 'The fund posts tokens it already holds. The vault locks what the margin needs.' },
  { title: 'Call', text: 'Rates move against the fund. A margin call opens, with a deadline.' },
  { title: 'Settle', text: 'Not covered in time? The locked tokens go to the bank. Nothing more.' },
] as const

/** Story position, 0 (Lock centered) to 2 (Settle centered): the same mapping as CylinderText. */
const storyStep = (p: number) => Math.min(1, Math.max(0, (p - 0.08) / 0.84)) * (STEPS.length - 1)

/** One stop of the story track: an empty ring that fills in ink when the story reaches it. */
function StoryDot({ index, step, label }: { index: number; step: MotionValue<number>; label: string }) {
  const fill = useTransform(step, [index - 0.35, index - 0.05], [0, 1])
  const scale = useTransform(step, [index - 0.35, index - 0.15, index - 0.05], [1, 1.35, 1])
  const text = useTransform(step, [index - 0.6, index - 0.05], [0.35, 1])
  return (
    <div className="relative flex items-center gap-5">
      <motion.span style={{ scale }} className="flex size-5 items-center justify-center rounded-full border-[1.5px] border-ink bg-canvas">
        <motion.span style={{ opacity: fill }} className="size-full rounded-full bg-ink" />
      </motion.span>
      <motion.span style={{ opacity: text }} className="text-sm font-medium tracking-[0.18em] uppercase">
        {label}
      </motion.span>
    </div>
  )
}

/** Three points joined one after the other as the story scrolls: Lock, then Call, then Settle. */
function StoryTrack({ progress, still }: { progress: MotionValue<number>; still: boolean }) {
  const step = useTransform(progress, (p) => (still ? STEPS.length - 1 : storyStep(p)))
  const line = useTransform(step, (s) => s / (STEPS.length - 1))
  return (
    <div className="relative hidden h-[min(52svh,26rem)] flex-col justify-between md:flex" aria-hidden="true">
      {/* the track, and the ink that joins the points as the story reaches them */}
      <span className="absolute top-2.5 bottom-2.5 left-[9px] w-[1.5px] bg-ink/15" />
      <motion.span style={{ scaleY: line }} className="absolute top-2.5 bottom-2.5 left-[9px] w-[1.5px] origin-top bg-ink" />
      {STEPS.map((s, i) => (
        <StoryDot key={s.title} index={i} step={step} label={s.title} />
      ))}
    </div>
  )
}

/**
 * Apple-style arrival, one screen per chapter: the hero recedes, the story turns while pinned, the
 * timeline and How it works pass by, then the collateral choice grows until it fills the screen.
 */
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
  const info = config.assets.find((a) => a.id === asset)

  const hero = useRef<HTMLElement>(null)
  const { scrollYProgress: heroProgress } = useScroll({ target: hero, offset: ['start start', 'end start'] })
  const heroScale = useTransform(heroProgress, [0, 1], [1, 0.86])
  const heroOpacity = useTransform(heroProgress, [0, 0.7], [1, 0])
  // 'none' at rest: blur(0px) would still run a filter pass on every frame.
  const heroBlur = useTransform(heroProgress, (p) => (p < 0.02 ? 'none' : `blur(${(p * 8).toFixed(1)}px)`))

  const story = useRef<HTMLElement>(null)
  const { scrollYProgress: storyProgress } = useScroll({ target: story, offset: ['start start', 'end end'] })

  // The collateral stage: pinned for one screen, its panel grows from a card to the whole screen.
  const stage = useRef<HTMLElement>(null)
  const { scrollYProgress: arrive } = useScroll({ target: stage, offset: ['start end', 'start start'] })
  const { scrollYProgress: grow } = useScroll({ target: stage, offset: ['start start', 'end end'] })
  const panelOpacity = useTransform(arrive, [0.35, 0.9], [0, 1])
  const clipPath = useTransform(grow, (p) => {
    const k = 1 - Math.min(1, p / 0.75)
    // On a phone the card starts nearly as wide as the screen: its text must fit from the start.
    const narrow = typeof window !== 'undefined' && window.innerWidth < 640
    const [y, x] = narrow ? [12, 4] : [20, 24]
    return `inset(${(k * y).toFixed(2)}% ${(k * x).toFixed(2)}% round ${(k * (narrow ? 32 : 48)).toFixed(1)}px)`
  })
  const contentScale = useTransform(grow, [0, 0.75], [0.86, 1])
  const contentOpacity = useTransform(arrive, [0.5, 1], [0, 1])

  // Large screens pin the stage and grow its panel; phones, short screens and reduced motion get
  // the plain panel, one screen tall.
  const pinned = usePinned()

  // The "Start" shortcuts land where the stage is fully grown.
  const toStart = (smooth = !still) => {
    const el = stage.current
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY
    window.scrollTo({ top: top + el.offsetHeight - window.innerHeight, behavior: smooth ? 'smooth' : 'auto' })
  }

  return (
    <div>
      <section ref={hero} className="relative flex h-svh min-h-[34rem] items-center justify-center px-6 pt-16">
        <motion.div style={still ? undefined : { scale: heroScale, opacity: heroOpacity, filter: heroBlur }} className="text-center">
          <h1 className="title-hero">
            <BlurReveal text="Post tokens," />
            <br />
            <BlurReveal text="not cash." delay={0.25} />
          </h1>
          {/* Vapor Type: the three beats of the story condense out of vapor, one after the other. */}
          <div className="mt-[clamp(1.25rem,3svh,2.5rem)] h-24" aria-label="Lock, Call, Settle">
            <VaporText words={VAPOR_WORDS} fontSize={64} holdMs={1300} />
          </div>
          {/* Ghost Type: the line writes itself, a grey completion is accepted with Tab. */}
          <p className="text-lead mx-auto mt-2 min-h-16 max-w-xl text-ink-muted">
            <GhostType typed="Margin calls, covered by" ghost=" the assets a fund already holds." tail=" On Stellar." />
          </p>
          <Magnetic className="mt-[clamp(1.5rem,5svh,3.5rem)]">
            <motion.button
              type="button"
              className="glass flex h-12 items-center gap-2 rounded-full px-6 text-sm font-medium text-ink shadow-card"
              whileTap={{ scale: 0.96 }}
              onClick={() => toStart()}
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

      <section ref={story} className="relative h-[300svh]">
        <div className="sticky top-0 flex h-svh items-center px-6">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-16 md:grid-cols-[minmax(0,1fr)_14rem]">
            <CylinderText lines={STEPS} progress={storyProgress} />
            <StoryTrack progress={storyProgress} still={still} />
          </div>
        </div>
      </section>

      <Journey />
      <HowItWorks onStart={() => toStart()} />

      <section
        ref={stage}
        className={pinned ? 'relative h-[200svh]' : 'relative min-h-svh'}
        aria-labelledby="collateral-title"
        // Keyboard focus on a control of the still small, faint panel jumps to the grown one.
        onFocusCapture={() => pinned && grow.get() < 0.75 && toStart(false)}
      >
        <div className={pinned ? 'sticky top-0 h-svh' : 'flex min-h-svh py-24'}>
          {/* A plain translucent panel (no backdrop blur): it fills the screen and grows on every
              scroll frame, and the aura behind is already soft. */}
          <motion.div
            className={cx('flex items-center justify-center bg-white/45 px-6 shadow-card', pinned ? 'absolute inset-0' : 'w-full')}
            style={pinned ? { clipPath, opacity: panelOpacity } : undefined}
          >
            <motion.div
              className="flex w-full max-w-2xl flex-col items-center text-center"
              style={pinned ? { scale: contentScale, opacity: contentOpacity } : undefined}
            >
              <p className="label-caps">Choose the collateral</p>
              <h2 id="collateral-title" className="title-section mt-4">
                What will the fund post?
              </h2>
              <p className="text-lead mt-5 text-ink-muted">Fictitious tokens, issued on Stellar Testnet.</p>
              <SegmentedControl
                className="mt-10"
                size="lg"
                label="Collateral asset"
                value={asset}
                onChange={setAsset}
                options={config.assets.map((a) => ({ value: a.id, label: a.code }))}
              />
              <p className={cx('mt-6 min-h-6 text-ink-subtle', !info && 'invisible')}>
                {info ? `${info.label} · €${formatEur(info.unitPriceEur)} (simulated) · haircut ${info.haircutPct}%` : '·'}
              </p>
              <Button className="mt-10 !h-14 w-full max-w-sm text-base" variant="primary" busy={busy} onClick={() => onStart(asset)}>
                {busy ? 'Deploying the vault…' : 'Start'}
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
