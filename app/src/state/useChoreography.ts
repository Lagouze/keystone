import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import type { SessionState, VaultStatus } from '@keystone/shared'

/**
 * Timings of the choreography agreed with the team (design canvas, artboard 7). t = 0 is the
 * arrival of a confirmed state over SSE; the hash of the confirming transaction decrypts in the
 * feed meanwhile (0 → 400 ms). One loud moment at a time: the status flip, then the figures,
 * then the card, then the countdown.
 */
export const CHOREO = {
  flipAt: 400,
  flipMs: 600,
  figuresAt: 1000,
  figuresMs: 350,
  /** Figures move right away when the status does not change (e.g. collateral released). */
  figuresAtNoFlip: 400,
  haloAt: 1350,
  countdownAt: 1550,
  transferMs: 700,
  settledRedAt: 1700,
  openingStaggerMs: 60,
  openingMs: 1300,
} as const

export interface Stage {
  /** What the vault, balances and on-chain figures show (lags the confirmed state). */
  shown: SessionState
  /** Status shown by the status pill (flips at `flipAt`). */
  status: VaultStatus
  /** Margin-call card lit (tinted, ringed, star border running). */
  halo: boolean
  /** Countdown visible and running. */
  countdown: boolean
  /** Collateral token travelling from the vault to the bank. */
  transfer: boolean
  /** Locked amount just before the default was settled (what the token carries). */
  transferUnits: string | null
  /** Default settled: card turns red, actions are disabled. */
  settled: boolean
  /** A session just opened: cards fade in, the key figure counts up once. */
  opening: boolean
  /** Duration, in seconds, the counters should use for the current change. */
  figuresDuration: number
}

function restingStage(session: SessionState): Stage {
  const status = session.vault.status
  return {
    shown: session,
    status,
    halo: status === 'margin_call',
    countdown: status === 'margin_call',
    transfer: false,
    transferUnits: null,
    settled: status === 'defaulted',
    opening: false,
    figuresDuration: CHOREO.figuresMs / 1000,
  }
}

/**
 * Turns each confirmed state into a sequence of display steps. A new state arriving mid-sequence
 * snaps the previous one to its end, then plays its own. Reduced motion: no sequence, the new
 * state shows at once.
 */
export function useChoreography(session: SessionState | null): Stage | null {
  const reduced = useReducedMotion()
  const [stage, setStage] = useState<Stage | null>(() => (session ? restingStage(session) : null))
  const timers = useRef<number[]>([])
  const target = useRef<SessionState | null>(session)

  // Timers are cleared when a new sequence starts or on unmount, never by a re-render: the same
  // state often arrives twice (write-route response, then SSE) and must not cut a sequence short.
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), [])

  useEffect(() => {
    const prev = target.current
    if (prev && session && prev.sessionId === session.sessionId && prev.updatedAt === session.updatedAt) return

    const clear = () => {
      timers.current.forEach((id) => window.clearTimeout(id))
      timers.current = []
    }
    const at = (ms: number, apply: (s: Stage) => Stage) => {
      timers.current.push(window.setTimeout(() => setStage((s) => (s ? apply(s) : s)), ms))
    }

    target.current = session
    clear()

    if (!session) {
      setStage(null)
      return
    }

    // First load, a new session, or reduced motion: no sequence.
    if (!prev || prev.sessionId !== session.sessionId || reduced) {
      const opening = !!prev && prev.sessionId !== session.sessionId && !reduced
      setStage({ ...restingStage(session), opening })
      if (opening) at(CHOREO.openingMs, (s) => ({ ...s, opening: false }))
      return
    }

    const from = prev.vault.status
    const to = session.vault.status
    const flips = from !== to

    // Snap any unfinished sequence to the previous target, then update what is not choreographed:
    // the swap and margin figures (rate shock, MTM) roll as soon as they arrive.
    setStage((s) => ({
      ...restingStage(prev),
      opening: s?.opening ?? false,
      shown: { ...prev, swap: session.swap, margin: session.margin, updatedAt: session.updatedAt },
    }))

    if (!flips) {
      at(CHOREO.figuresAtNoFlip, (s) => ({ ...s, shown: session, figuresDuration: CHOREO.figuresMs / 1000 }))
      return
    }

    at(CHOREO.flipAt, (s) => ({ ...s, status: to, countdown: false }))

    if (to === 'defaulted') {
      at(CHOREO.figuresAt, (s) => ({
        ...s,
        shown: session,
        halo: false,
        transfer: true,
        transferUnits: prev.vault.lockedUnits,
        figuresDuration: CHOREO.transferMs / 1000,
      }))
      at(CHOREO.figuresAt + CHOREO.transferMs, (s) => ({ ...s, transfer: false }))
      at(CHOREO.settledRedAt, (s) => ({ ...s, settled: true }))
      return
    }

    at(CHOREO.figuresAt, (s) => ({
      ...s,
      shown: session,
      halo: to === 'margin_call' ? s.halo : false,
      figuresDuration: CHOREO.figuresMs / 1000,
    }))
    if (to === 'margin_call') {
      at(CHOREO.haloAt, (s) => ({ ...s, halo: true }))
      at(CHOREO.countdownAt, (s) => ({ ...s, countdown: true }))
    }
  }, [session, reduced])

  return stage
}
