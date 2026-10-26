import { motion, useReducedMotion, useTransform, type MotionValue } from 'motion/react'

export interface CylinderLine {
  title: string
  text: string
}

const ANGLE = 58 // degrees between two lines on the cylinder
const RADIUS = 90 // px

function Line({ index, count, progress, line }: { index: number; count: number; progress: MotionValue<number>; line: CylinderLine }) {
  // `t` runs 0 (first line centered) to count - 1 (last line centered) over the section's scroll.
  const t = useTransform(progress, (p) => Math.min(1, Math.max(0, (p - 0.08) / 0.84)) * (count - 1))
  const angle = useTransform(t, (v) => (index - v) * ANGLE)
  const transform = useTransform(angle, (a) => `rotateX(${-a}deg) translateZ(${RADIUS}px)`)
  const opacity = useTransform(angle, (a) => Math.max(0, 1 - Math.abs(a) / 62))
  const blur = useTransform(angle, (a) => `blur(${Math.min(6, Math.abs(a) / 12)}px)`)
  return (
    <motion.div
      className="absolute inset-x-0 top-1/2 -mt-24 px-8 [backface-visibility:hidden]"
      style={{ transform, opacity, filter: blur, transformOrigin: '50% 50%' }}
    >
      <h3 className="text-5xl font-semibold uppercase tracking-tight sm:text-7xl">{line.title}</h3>
      <p className="mt-3 max-w-md text-lg text-ink-muted">{line.text}</p>
    </motion.div>
  )
}

/**
 * React Bits "3D Text Reveal": lines of text on a 3D cylinder that turns as you scroll. `progress`
 * is the 0 to 1 scroll progress of the section that pins it. Reduced motion lists the lines.
 */
export function CylinderText({ lines, progress }: { lines: readonly CylinderLine[]; progress: MotionValue<number> }) {
  const still = useReducedMotion()
  if (still) {
    return (
      <div className="grid gap-8">
        {lines.map((l) => (
          <div key={l.title}>
            <h3 className="text-4xl font-semibold uppercase tracking-tight">{l.title}</h3>
            <p className="mt-2 max-w-md text-lg text-ink-muted">{l.text}</p>
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="relative h-80" style={{ perspective: '1100px' }}>
      <div className="absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>
        {lines.map((line, i) => (
          <Line key={line.title} index={i} count={lines.length} progress={progress} line={line} />
        ))}
      </div>
    </div>
  )
}
