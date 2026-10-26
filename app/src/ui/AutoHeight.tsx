import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'

/**
 * Glides to the height of its content instead of jumping: when a panel grows or shrinks (a margin
 * call appears, signing steps come and go), the panels below slide instead of snapping. Clips only
 * while it moves, so focus rings and shadows stay visible at rest.
 */
export function AutoHeight({ children }: { children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const still = useReducedMotion()
  const [height, setHeight] = useState<number | 'auto'>('auto')

  useLayoutEffect(() => {
    const el = inner.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      const next = entry?.borderBoxSize?.[0]?.blockSize ?? el.offsetHeight
      setHeight((current) => {
        if (current !== 'auto' && Math.abs(current - next) <= 0.5) return current
        // Clip at once, in the observer's callback: new content must not spill over the next
        // panel for the frame or two before the animation starts.
        if (current !== 'auto' && outer.current) outer.current.style.overflow = 'hidden'
        return next
      })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <motion.div
      ref={outer}
      initial={false}
      animate={{ height }}
      transition={still ? { duration: 0 } : { duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
      onAnimationComplete={() => {
        if (outer.current) outer.current.style.overflow = ''
      }}
    >
      <div ref={inner}>{children}</div>
    </motion.div>
  )
}
