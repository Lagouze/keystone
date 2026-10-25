import type { ReactNode } from 'react'
import { cx } from './cx.ts'

interface CardProps {
  title?: string
  /** One sentence explaining the block to a viewer who does not know derivatives. */
  description?: string
  actions?: ReactNode
  className?: string
  children: ReactNode
}

export function Card({ title, description, actions, className, children }: CardProps) {
  return (
    <section
      className={cx('rounded-card border border-line bg-surface p-5 sm:p-6', className)}
    >
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-48 flex-1">
            {title && <h2 className="text-base font-medium text-ink">{title}</h2>}
            {description && (
              <p className="mt-1 text-sm text-ink-muted">{description}</p>
            )}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  )
}
