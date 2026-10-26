import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'motion/react'

interface Particle {
  tx: number
  ty: number
  sx: number
  sy: number
  ex: number
  ey: number
  size: number
  delay: number
}

interface VaporTextProps {
  words: readonly string[]
  /** CSS font shorthand without size, e.g. "500". */
  fontWeight?: number
  fontSize?: number
  color?: string
  /** Time a word stays readable. */
  holdMs?: number
  className?: string
}

const IN_MS = 1300
const OUT_MS = 1200

const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3)

/**
 * React Bits "Vapor Type": each word condenses out of a vapor of particles, holds, then drifts
 * away. The word is sampled from a canvas, so any font renders. The accessible text is the
 * current word, in a visually hidden span; the canvas is decorative.
 */
export function VaporText({ words, fontWeight = 500, fontSize = 72, color = '#1c1c1e', holdMs = 1500, className }: VaporTextProps) {
  const still = useReducedMotion()
  const canvas = useRef<HTMLCanvasElement>(null)
  const live = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = canvas.current
    if (!el || still) return
    const ctx = el.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const font = `${fontWeight} ${fontSize * dpr}px "Helvetica Neue", Helvetica, Arial, sans-serif`
    const probe = document.createElement('canvas').getContext('2d')!
    probe.font = font
    const widest = Math.max(...words.map((w) => probe.measureText(w).width))
    const width = Math.ceil(widest + fontSize * dpr * 0.6)
    const height = Math.ceil(fontSize * dpr * 1.5)
    el.width = width
    el.height = height
    el.style.width = `${width / dpr}px`
    el.style.height = `${height / dpr}px`

    const sample = (word: string): Particle[] => {
      const off = document.createElement('canvas')
      off.width = width
      off.height = height
      const o = off.getContext('2d', { willReadFrequently: true })!
      o.font = font
      o.textAlign = 'center'
      o.textBaseline = 'middle'
      o.fillStyle = '#000'
      o.fillText(word, width / 2, height / 2)
      const data = o.getImageData(0, 0, width, height).data
      const step = Math.max(2, Math.round(1.7 * dpr))
      const out: Particle[] = []
      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          if ((data[(y * width + x) * 4 + 3] ?? 0) < 128) continue
          const a = Math.random() * Math.PI * 2
          const r = (0.2 + Math.random()) * fontSize * dpr * 0.9
          out.push({
            tx: x,
            ty: y,
            // condense from a cloud on the left, drift away up and to the right
            sx: x - fontSize * dpr * 0.6 + Math.cos(a) * r,
            sy: y + Math.sin(a) * r * 0.8,
            ex: x + fontSize * dpr * (0.7 + Math.random() * 1.1),
            ey: y - fontSize * dpr * (0.2 + Math.random() * 0.9),
            size: step * (0.8 + Math.random() * 0.35),
            delay: Math.random() * 0.35,
          })
        }
      }
      return out
    }

    const LEVELS = 16
    const buckets: number[][] = Array.from({ length: LEVELS }, () => [])
    let index = 0
    let particles = sample(words[0]!)
    let started = performance.now()
    if (live.current) live.current.textContent = words[0]!
    let frame = 0
    // Off screen: keep the clock, skip the drawing.
    let visible = true
    const io = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true
    })
    io.observe(el)

    const draw = (now: number) => {
      if (!visible) {
        frame = requestAnimationFrame(draw)
        return
      }
      const t = now - started
      const total = IN_MS + holdMs + OUT_MS
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = color
      // Particles are grouped by opacity (16 levels) and drawn level by level: 16 globalAlpha
      // changes per frame instead of one per particle.
      for (const path of buckets) path.length = 0
      for (const p of particles) {
        let x: number
        let y: number
        let alpha: number
        if (t < IN_MS) {
          const k = ease((t / IN_MS - p.delay) / (1 - p.delay))
          x = p.sx + (p.tx - p.sx) * k
          y = p.sy + (p.ty - p.sy) * k
          alpha = k
        } else if (t < IN_MS + holdMs) {
          const j = Math.sin((t + p.tx * 7) / 260) * 0.35 * dpr
          x = p.tx + j
          y = p.ty + Math.cos((t + p.ty * 5) / 300) * 0.35 * dpr
          alpha = 1
        } else {
          const k = ease(((t - IN_MS - holdMs) / OUT_MS - p.delay) / (1 - p.delay))
          x = p.tx + (p.ex - p.tx) * k
          y = p.ty + (p.ey - p.ty) * k
          alpha = 1 - k
        }
        if (alpha <= 0.02) continue
        buckets[Math.min(LEVELS - 1, Math.floor(alpha * LEVELS))]!.push(x, y, p.size)
      }
      for (let level = 0; level < LEVELS; level++) {
        const rects = buckets[level]!
        if (!rects.length) continue
        ctx.globalAlpha = (level + 1) / LEVELS
        for (let i = 0; i < rects.length; i += 3) ctx.fillRect(rects[i]!, rects[i + 1]!, rects[i + 2]!, rects[i + 2]!)
      }
      ctx.globalAlpha = 1
      if (t >= total) {
        index = (index + 1) % words.length
        particles = sample(words[index]!)
        started = now
        if (live.current) live.current.textContent = words[index]!
      }
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
      io.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words.join('|'), fontWeight, fontSize, color, holdMs, still])

  if (still) {
    return <span className={className}>{words.join(' · ')}</span>
  }
  return (
    <span className={className}>
      <canvas ref={canvas} aria-hidden="true" className="mx-auto block" />
      <span ref={live} className="sr-only" aria-live="polite" />
    </span>
  )
}
