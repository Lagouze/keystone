import type { ButtonHTMLAttributes, MouseEvent } from 'react'
import { motion } from 'motion/react'
import { cx } from './cx.ts'

type Variant = 'primary' | 'secondary' | 'sim' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  /** Waiting state while a request or transaction is in flight. The button keeps its focus. */
  busy?: boolean
}

const VARIANTS: Record<Variant, string> = {
  // Black primary, Apple style; blue stays reserved for on-chain proof.
  primary: 'bg-ink text-white shadow-[0_8px_24px_-8px_rgba(0,0,0,0.45)] enabled:hover:bg-ink-hover',
  secondary: 'glass text-ink enabled:hover:bg-white/60',
  sim: 'glass text-ink enabled:hover:bg-white/60',
  danger: 'bg-danger text-white enabled:hover:bg-danger-hover',
}

export function Button({
  variant = 'secondary',
  busy = false,
  className,
  children,
  onClick,
  ...rest
}: ButtonProps) {
  return (
    <motion.button
      type="button"
      {...(rest as Record<string, unknown>)}
      // Micro-interaction: every press gives way slightly.
      whileTap={rest.disabled || busy ? undefined : { scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      aria-disabled={busy || undefined}
      aria-busy={busy || undefined}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        // Also stops a submit button from submitting its form again while busy.
        if (busy) event.preventDefault()
        else onClick?.(event)
      }}
      className={cx(
        'inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition-colors duration-120 ease-std',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chain',
        'disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-progress',
        VARIANTS[variant],
        className,
      )}
    >
      {busy && (
        <span aria-hidden="true" className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-1 rounded-full bg-current motion-safe:animate-dot" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </span>
      )}
      {children}
    </motion.button>
  )
}
