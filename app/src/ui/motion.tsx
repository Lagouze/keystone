// Keystone presets for the React Bits components: tokens, durations and the single typeface are
// set here once, so the dashboard never configures the raw components itself.
import { useEffect, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { formatUnits } from '../lib/format.ts'
import Counter from './bits/Counter.tsx'
import CountUp from './bits/CountUp.tsx'
import DecryptedText from './bits/DecryptedText.tsx'
import HoldButton from './bits/HoldButton.tsx'
import LatticeLoader from './bits/LatticeLoader.tsx'
import ShinyText from './bits/ShinyText.tsx'
import SplitFlapText from './bits/SplitFlapText.tsx'
import StatusMark from './bits/StatusMark.tsx'
import Stepper, { Step } from './bits/Stepper.tsx'
import { CHOREO } from '../state/useChoreography.ts'

const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif'
const INK = '#0b1f33'
const CHAIN = '#1f5fbf'
const DANGER = '#b42318'

/** A number that rolls to its new value (Counter, odometer style). Display only. */
export function Figure({
  value,
  decimals = 0,
  duration = CHOREO.figuresMs / 1000,
  minDigits,
}: {
  value: number
  decimals?: number
  duration?: number
  minDigits?: number
}) {
  return (
    <Counter
      value={value}
      decimals={decimals}
      minDigits={minDigits}
      duration={duration}
      bounce={0}
      stagger={0.02}
      motionBlur={false}
      intro={false}
      fontSize="1em"
      fontWeight="inherit"
      textColor="currentColor"
      tabular
    />
  )
}

/** Number of decimals to show for a token amount: whole units stay whole. */
export function unitDecimals(value: number): number {
  return Number.isInteger(Math.round(value * 100) / 100) ? 0 : 2
}

/**
 * A token amount that rolls. Built from formatUnits (floored to 2 decimals, never shows a non-zero
 * amount as 0), so the rolling figure always agrees with the text elsewhere on the screen.
 */
export function RollUnits({ units, decimals, duration }: { units: string; decimals: number; duration?: number }) {
  const text = formatUnits(units, decimals)
  if (text.includes('<')) return <>{text}</>
  const value = Number(text.replace(/,/g, '').replace('−', '-'))
  return <Figure value={value} decimals={unitDecimals(value)} duration={duration} />
}

/** The key figure counts up once when a session opens (CountUp), then rolls like the others. */
export function KeyFigure({ value, intro }: { value: number; intro: boolean }) {
  if (!intro) return <Figure value={value} decimals={2} />
  return <CountUp to={value} from={0} duration={0.8} decimals={2} separator="," trigger="load" />
}

/**
 * Status word flipping like a departure board (SplitFlapText), in Helvetica Neue. The board only
 * shows while it flips; at rest the word is plain text, without the board's fixed-width tiles.
 */
export function FlapLabel({ text }: { text: string }) {
  // Start flipping in the same render as the new word, so it never shows plainly for a frame.
  const reduced = useReducedMotion()
  const [last, setLast] = useState(text)
  const [flipping, setFlipping] = useState(false)
  if (text !== last && reduced) setLast(text)
  if (text !== last && !reduced) {
    setLast(text)
    setFlipping(true)
  }
  useEffect(() => {
    if (!flipping) return
    const id = window.setTimeout(() => setFlipping(false), CHOREO.flipMs + 200)
    return () => window.clearTimeout(id)
  }, [flipping, text])
  if (!flipping && text === last) return <>{text}</>
  return (
    <SplitFlapText
      text={text}
      loop={false}
      intro
      padTo={0}
      charset="alpha"
      flipsPerChar={3}
      flipDuration={0.06}
      stagger={0.02}
      tileStyle="minimal"
      tileColor="transparent"
      textColor="currentColor"
      fontSize="1em"
      gap={0}
      style={{ fontFamily: FONT, fontWeight: 500, letterSpacing: '0.05em' }}
    />
  )
}

/** mm:ss of the grace period; each pair of digits rolls down. */
export function Countdown({ seconds }: { seconds: number }) {
  return (
    <span className="inline-flex items-baseline">
      <Figure value={Math.floor(seconds / 60)} minDigits={2} duration={0.25} />
      <span>:</span>
      <Figure value={seconds % 60} minDigits={2} duration={0.25} />
    </span>
  )
}

/** The hash of a transaction decrypts once, when the entry turns confirmed (the proof moment). */
export function RevealHash({ text, animate }: { text: string; animate: boolean }) {
  if (!animate) return <>{text}</>
  return (
    <DecryptedText
      text={text}
      animateOn="view"
      sequential
      speed={35}
      maxIterations={8}
      characters="0123456789abcdef"
      encryptedClassName="text-ink-subtle"
    />
  )
}

/** Ring → progress arc → check for a Testnet entry (StatusMark). */
export function TxMark({ status }: { status: 'pending' | 'confirmed' | 'failed' }) {
  // Decorative: the visible text next to it (Pending, Failed, the hash) carries the meaning.
  return (
    <span aria-hidden="true" className="inline-flex">
    <StatusMark
      status={status === 'pending' ? 'running' : status === 'confirmed' ? 'done' : 'failed'}
      size={14}
      strokeWidth={1.75}
      color={CHAIN}
      doneColor={CHAIN}
      errorColor={DANGER}
      drawDuration={200}
    />
    </span>
  )
}

/** Waiting for the ledger, with a live stopwatch (LatticeLoader). */
export function LedgerWait({ label = 'Waiting for the ledger' }: { label?: string }) {
  return <LatticeLoader label={label} color={CHAIN} fontSize={12} cellSize={4} gap={2} />
}

/** Soft sheen on the text shown while Freighter waits for the signature (ShinyText). */
export function Shiny({ children }: { children: string }) {
  return <ShinyText text={children} color={INK} shineColor="#9db5de" speed={1.6} />
}

export const SIGN_STEPS = ['Prepare', 'Sign', 'Submit', 'Confirmed'] as const

/** Prepare → Sign → Submit → Confirmed, with a gliding indicator (Stepper, indicator only). */
export function SigningSteps({ current }: { current: number }) {
  const [shown, setShown] = useState(current)
  useEffect(() => setShown(current), [current])
  return (
    <Stepper
      step={shown + 1}
      indicator="bars"
      showFooter={false}
      disableStepIndicators
      frame={false}
      theme="light"
      accentColor={CHAIN}
      transition="none"
    >
      {SIGN_STEPS.map((title) => (
        <Step key={title} title={title} />
      ))}
    </Stepper>
  )
}

/** Hold for 1.2 s to settle a default: an irreversible on-chain action (HoldButton). */
export function HoldToSettle({ disabled, onHold }: { disabled: boolean; onHold: () => void }) {
  return (
    <HoldButton
      holdTime={1200}
      releaseTime={200}
      backgroundColor={DANGER}
      fillColor="#8f1c13"
      textColor="#ffffff"
      fillTextColor="#ffffff"
      size="md"
      radius={999}
      wave={false}
      glow={false}
      // Back to idle after a refused or failed settlement (e.g. GracePeriodRunning); on success the
      // card leaves the margin-call state anyway.
      resetAfter={1200}
      disabled={disabled}
      doneLabel="Settling…"
      onHold={onHold}
    >
      Hold to settle default
    </HoldButton>
  )
}
