import type { ReactNode } from 'react'
import { cx } from './cx.ts'

type Tone = 'default' | 'call' | 'default-settled'

const TONES: Record<Tone, string> = {
  default: 'border-line bg-surface shadow-card',
  // The margin-call card is the only one that is tinted and ringed (Flighty's single alert).
  call: 'border-warning/45 bg-warning-tint shadow-call',
  'default-settled': 'border-danger/45 bg-surface shadow-card',
}

interface CardProps {
  title?: string
  /** One sentence explaining the block to a viewer who does not know derivatives. */
  description?: string
  actions?: ReactNode
  tone?: Tone
  className?: string
  children: ReactNode
}

export function Card({ title, description, actions, tone = 'default', className, children }: CardProps) {
  return (
    <section
      className={cx(
        'rounded-card border p-5 transition-[background-color,border-color,box-shadow] duration-200 ease-std sm:p-6',
        TONES[tone],
        className,
      )}
    >
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-48 flex-1">
            {title && <h2 className="text-base font-medium text-ink">{title}</h2>}
            {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  )
}
