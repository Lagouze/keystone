import { motion, useReducedMotion } from 'motion/react'
import { useId } from 'react'

/**
 * A slim trend line with a soft area under it (the "Growing Fast" stat card of the references).
 * The line draws itself, then follows every new point.
 */
export function Sparkline({ values, height = 72, className }: { values: readonly number[]; height?: number; className?: string }) {
  const id = useId()
  const still = useReducedMotion()
  if (values.length < 2) return <div style={{ height }} aria-hidden="true" />
  const W = 320
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pad = 6
  const pts = values.map((v, i) => [(i / (values.length - 1)) * W, pad + (1 - (v - min) / span) * (height - pad * 2)] as const)
  // Smooth the polyline with midpoints (quadratic curves).
  let d = `M${pts[0]![0]},${pts[0]![1]}`
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]!
    const [x1, y1] = pts[i]!
    d += ` Q${x0},${y0} ${(x0 + x1) / 2},${(y0 + y1) / 2}`
  }
  const last = pts[pts.length - 1]!
  d += ` T${last[0]},${last[1]}`
  const area = `${d} L${W},${height} L0,${height} Z`
  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height} preserveAspectRatio="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spark-${id})`} />
      <motion.path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        initial={still ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
      />
    </svg>
  )
}
