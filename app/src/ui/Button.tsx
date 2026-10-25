import type { ButtonHTMLAttributes, MouseEvent } from 'react'
import { cx } from './cx.ts'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  /** Waiting state while a request or transaction is in flight. The button keeps its focus. */
  busy?: boolean
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-white enabled:hover:bg-accent-hover',
  secondary: 'border border-line-strong bg-surface text-ink enabled:hover:bg-surface-muted',
  ghost: 'text-accent enabled:hover:bg-accent-soft',
  danger: 'bg-danger text-white enabled:hover:bg-danger-ink',
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
    <button
      type="button"
      {...rest}
      aria-disabled={busy || undefined}
      aria-busy={busy || undefined}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        // Also stops a submit button from submitting its form again while busy.
        if (busy) event.preventDefault()
        else onClick?.(event)
      }}
      className={cx(
        'inline-flex h-10 items-center justify-center gap-2 rounded-control px-4 text-sm font-medium transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-progress',
        VARIANTS[variant],
        className,
      )}
    >
      {busy && (
        <span
          aria-hidden="true"
          className="size-3.5 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin"
        />
      )}
      {children}
    </button>
  )
}
