import { motion, useReducedMotion } from 'motion/react'

// The mark: an arch of seven stones closed by the keystone, the one stone that holds the others in
// place. Collateral works the same way: one rule, enforced by the vault, locks everything else.
// Same geometry as public/logo-mark.svg, public/logo-lockup.svg and public/favicon.svg.
const STONES = [
  "M7.00 66.00A43 43 0 0 1 11.10 47.67L23.77 53.64A29 29 0 0 0 21.00 66.00Z",
  "M11.84 46.19A43 43 0 0 1 23.27 32.32L31.97 43.28A29 29 0 0 0 24.26 52.64Z",
  "M24.58 31.32A43 43 0 0 1 40.99 23.96L43.92 37.64A29 29 0 0 0 32.86 42.61Z",
  "M59.01 23.96A43 43 0 0 1 75.42 31.32L67.14 42.61A29 29 0 0 0 56.08 37.64Z",
  "M76.73 32.32A43 43 0 0 1 88.16 46.19L75.74 52.64A29 29 0 0 0 68.03 43.28Z",
  "M88.90 47.67A43 43 0 0 1 93.00 66.00L79.00 66.00A29 29 0 0 0 76.23 53.64Z"
] as const
const KEYSTONE = "M41.58 17.73A49 49 0 0 1 58.42 17.73L54.99 37.43A29 29 0 0 0 45.01 37.43Z"

interface LogoProps {
  size?: number
  className?: string
  /** The stones appear one after another, then the keystone drops in and locks the arch. */
  animated?: boolean
}

/** Monochrome: it takes the current text colour, so it works on any surface. */
export function Logo({ size = 96, className, animated = false }: LogoProps) {
  const still = useReducedMotion()
  const play = animated && !still
  return (
    <svg width={size} height={(size * 58) / 100} viewBox="0 12 100 58" fill="currentColor" aria-hidden="true" className={className}>
      {STONES.map((d, i) => (
        <motion.path
          key={i}
          d={d}
          initial={play ? { opacity: 0, y: 5 } : false}
          animate={{ opacity: 0.2, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 + i * 0.07, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
      <motion.path
        d={KEYSTONE}
        initial={play ? { opacity: 0, y: -16 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.7 }}
      />
    </svg>
  )
}
