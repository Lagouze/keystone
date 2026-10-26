import { useEffect, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { cx } from './cx.ts'

interface GhostTypeProps {
  /** What is "typed" first, character by character. */
  typed: string
  /** The completion suggested in grey, then accepted. */
  ghost: string
  /** Typed after the completion is accepted. */
  tail?: string
  className?: string
}

type Phase = 'typing' | 'suggest' | 'accept' | 'tail' | 'done'

/**
 * React Bits "Ghost Type": the line writes itself, an AI-style completion appears in ghost grey,
 * is accepted with Tab (a brief tint, then solid ink), and the line finishes. The full sentence
 * is in the accessible name from the start; reduced motion shows it at once.
 */
export function GhostType({ typed, ghost, tail = '', className }: GhostTypeProps) {
  const still = useReducedMotion()
  const [phase, setPhase] = useState<Phase>('typing')
  const [count, setCount] = useState(0)
  const full = typed + ghost + tail

  useEffect(() => {
    if (still) return
    let timer: number
    if (phase === 'typing') {
      timer = window.setTimeout(() => (count < typed.length ? setCount(count + 1) : setPhase('suggest')), count === 0 ? 700 : 38 + Math.random() * 40)
    } else if (phase === 'suggest') {
      timer = window.setTimeout(() => setPhase('accept'), 1300)
    } else if (phase === 'accept') {
      timer = window.setTimeout(() => {
        setCount(0)
        setPhase(tail ? 'tail' : 'done')
      }, 650)
    } else if (phase === 'tail') {
      timer = window.setTimeout(() => (count < tail.length ? setCount(count + 1) : setPhase('done')), 42)
    }
    return () => window.clearTimeout(timer)
  }, [phase, count, typed, tail, still])

  if (still) return <span className={className}>{full}</span>

  const shownTyped = phase === 'typing' ? typed.slice(0, count) : typed
  const ghostShown = phase === 'suggest' || phase === 'accept'
  const accepted = phase === 'tail' || phase === 'done'
  const caret = phase !== 'done'
  return (
    <span className={cx('relative inline', className)} aria-label={full}>
      <span aria-hidden="true">
        <span>{shownTyped}</span>
        {(ghostShown || accepted) && (
          <span
            className="transition-colors duration-500 ease-out"
            style={{ color: accepted ? 'inherit' : phase === 'accept' ? '#6f5bd6' : 'rgba(28,28,30,0.32)' }}
          >
            {ghost}
          </span>
        )}
        {phase === 'tail' && <span>{tail.slice(0, count)}</span>}
        {phase === 'done' && <span>{tail}</span>}
        {caret && <span className="ml-px inline-block h-[1.05em] w-[2px] translate-y-[0.15em] animate-pulse bg-current align-baseline" />}
        {phase === 'suggest' && <span className="ml-2 align-middle text-xs tracking-widest text-ink-subtle">TAB</span>}
      </span>
    </span>
  )
}
