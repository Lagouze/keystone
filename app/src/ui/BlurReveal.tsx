import { motion, useReducedMotion } from 'motion/react'

/** Fluid text reveal (React Bits "Blur Text"): each word comes out of a blur, one after the other. */
export function BlurReveal({ text, className, delay = 0 }: { text: string; className?: string; delay?: number }) {
  const still = useReducedMotion()
  const words = text.split(' ')
  return (
    <span className={className}>
      {/* The words are split for the animation; screen readers get the sentence once. */}
      <span className="sr-only">{text}</span>
      {words.map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          aria-hidden="true"
          className="inline-block"
          initial={still ? false : { opacity: 0, y: 14, filter: 'blur(10px)' }}
          // The filter is removed once sharp: a leftover blur(0px) still costs a filter pass.
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transitionEnd: { filter: 'none' } }}
          transition={{ duration: 0.7, delay: delay + i * 0.09, ease: [0.16, 1, 0.3, 1] }}
        >
          {word}
          {i < words.length - 1 ? ' ' : ''}
        </motion.span>
      ))}
    </span>
  )
}
