import { useEffect, useRef, useState, type ReactNode } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { cx } from './cx.ts'

const QUERY = '(min-width: 768px) and (min-height: 720px)'

/**
 * True when the screen is large enough for pinned chapters (their content fits in one screen,
 * header included) and motion is allowed. Below that, the landing simply flows. A pinned chapter
 * animates its own entrance, so its content skips its own whileInView entrances.
 */
export function usePinned(): boolean {
  const still = useReducedMotion()
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(QUERY).matches)
  useEffect(() => {
    const media = window.matchMedia(QUERY)
    const update = () => setWide(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return wide && !still
}

/**
 * One screen of the landing, Apple style: the chapter is pinned for one screen of scrolling, its
 * content fades in once it is pinned and out before it leaves, so two chapters are never on screen
 * together. On small screens and with reduced motion, it flows. Transform and opacity only.
 */
export function Chapter({
  children,
  labelledBy,
  follows = false,
  className,
}: {
  children: ReactNode
  labelledBy?: string
  /**
   * Directly after another chapter: it overlaps that chapter's last screen, so this one fades in
   * the moment the previous one has faded out, without an empty screen between them.
   */
  follows?: boolean
  className?: string
}) {
  const ref = useRef<HTMLElement>(null)
  const pinned = usePinned()
  // 0 → 1 over three screens: arriving, pinned, leaving. Content shows only in the pinned third.
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const opacity = useTransform(scrollYProgress, [0.33, 0.43, 0.57, 0.67], [0, 1, 1, 0])
  const y = useTransform(scrollYProgress, [0.33, 0.43, 0.57, 0.67], [48, 0, 0, -48])
  const scale = useTransform(scrollYProgress, [0.33, 0.43], [0.97, 1])
  // An invisible chapter lying over the visible one must not catch its clicks.
  const pointerEvents = useTransform(opacity, (o) => (o < 0.05 ? 'none' : 'auto'))

  if (!pinned) {
    return (
      <section ref={ref} aria-labelledby={labelledBy} className={cx('flex min-h-svh items-center px-6 py-24', className)}>
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </section>
    )
  }
  // Keyboard focus landing on a control of a hidden chapter scrolls to where the chapter shows.
  const reveal = () => {
    const el = ref.current
    if (!el || opacity.get() > 0.95) return
    const top = el.getBoundingClientRect().top + window.scrollY
    window.scrollTo({ top: top + window.innerHeight * 0.5 })
  }
  return (
    <section
      ref={ref}
      aria-labelledby={labelledBy}
      onFocusCapture={reveal}
      className={cx('relative h-[200svh]', follows && '-mt-[100svh]', className)}
    >
      <div className="sticky top-0 flex h-svh items-center px-6 pt-16">
        <motion.div style={{ opacity, y, scale, pointerEvents }} className="mx-auto w-full max-w-6xl">
          {children}
        </motion.div>
      </div>
    </section>
  )
}
