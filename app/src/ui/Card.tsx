import type { ReactNode } from 'react'
import StarBorder from './bits/StarBorder.tsx'
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
  /**
   * Star-capable card (the status card): always rendered through StarBorder, so lighting the star
   * never remounts the content (focus, running animations). `star` turns the travelling light on.
   */
  starCapable?: boolean
  star?: boolean
  className?: string
  children: ReactNode
}

export function Card({
  title,
  description,
  actions,
  tone = 'default',
  starCapable = false,
  star = false,
  className,
  children,
}: CardProps) {
  const body = (
    <>
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
    </>
  )

  if (starCapable) {
    const lit = star && tone === 'call'
    const palette = {
      call: { bg: '#fffcf5', border: 'rgba(184, 110, 0, 0.45)', shadow: 'shadow-call' },
      default: { bg: '#ffffff', border: '#e3e7ed', shadow: 'shadow-card' },
      'default-settled': { bg: '#ffffff', border: 'rgba(180, 35, 24, 0.45)', shadow: 'shadow-card' },
    }[tone]
    return (
      <StarBorder
        as="section"
        theme="light"
        radius={16}
        thickness={1}
        duration={4}
        glow={lit ? 0.5 : 0}
        trailLength={lit ? 0.25 : 0}
        color={lit ? '#b86e00' : 'transparent'}
        trailColor={lit ? '#b86e00' : 'transparent'}
        borderColor={palette.border}
        backgroundColor={palette.bg}
        textColor="#0b1f33"
        hover="none"
        clickPulse={false}
        className={cx(
          '!block !w-full !items-stretch !p-5 !text-left !leading-normal !font-normal transition-shadow duration-200 sm:!p-6',
          palette.shadow,
          className,
        )}
      >
        {body}
      </StarBorder>
    )
  }

  return (
    <section
      className={cx(
        'rounded-card border p-5 transition-[background-color,border-color,box-shadow] duration-200 ease-std sm:p-6',
        TONES[tone],
        className,
      )}
    >
      {body}
    </section>
  )
}
