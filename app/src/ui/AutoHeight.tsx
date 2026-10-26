import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'

/**
 * Glides to the height of its content instead of jumping: when a panel grows or shrinks (a margin
 * call appears, signing steps come and go), the panels below slide instead of snapping. Clips only
 * while it moves, so focus rings and shadows stay visible at rest.
 */
export function AutoHeight({ children }: { children: ReactNode }) {
  const inner = useRef<HTMLDivElement>(null)
  const still = useReducedMotion()
  const [height, setHeight] = useState<number | 'auto'>('auto')
  const [moving, setMoving] = useState(false)

  useLayoutEffect(() => {
    const el = inner.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      const next = entry?.borderBoxSize?.[0]?.blockSize ?? el.offsetHeight
      setHeight((current) => (current === 'auto' || Math.abs(current - next) > 0.5 ? next : current))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <motion.div
      initial={false}
      animate={{ height }}
      transition={still ? { duration: 0 } : { duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
      onAnimationStart={() => setMoving(true)}
      onAnimationComplete={() => setMoving(false)}
      style={{ overflow: moving ? 'hidden' : 'visible' }}
    >
      <div ref={inner}>{children}</div>
    </motion.div>
  )
}
