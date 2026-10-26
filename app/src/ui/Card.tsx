import type { ReactNode } from 'react'
import StarBorder from './bits/StarBorder.tsx'
import { cx } from './cx.ts'

type Tone = 'default' | 'call' | 'default-settled'

// Frosted glass panels. Only the margin-call panel is tinted (sober red), like Flighty's single alert.
const TONES: Record<Tone, string> = {
  default: 'glass shadow-card',
  call: 'glass !bg-warning-tint shadow-call',
  'default-settled': 'glass shadow-card',
}

interface CardProps {
  title?: string
  /** A short line under the title. */
  description?: string
  actions?: ReactNode
  tone?: Tone
  /**
   * Star-capable panel (the status panel): always rendered through StarBorder, so lighting the star
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
          <div className="min-w-40 flex-1">
            {title && <h2 className="text-[0.9375rem] font-medium text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-ink-subtle">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </>
  )

  if (starCapable) {
    const lit = star && tone === 'call'
    return (
      <StarBorder
        as="section"
        theme="light"
        radius={28}
        thickness={1}
        duration={4}
        glow={lit ? 0.4 : 0}
        trailLength={lit ? 0.25 : 0}
        color={lit ? '#c9372c' : 'transparent'}
        trailColor={lit ? '#c9372c' : 'transparent'}
        borderColor={tone === 'call' ? 'rgba(201, 55, 44, 0.35)' : 'rgba(255, 255, 255, 0.7)'}
        backgroundColor={tone === 'call' ? 'rgba(255, 245, 244, 0.8)' : 'rgba(255, 255, 255, 0.72)'}
        textColor="#1d1d1f"
        hover="none"
        clickPulse={false}
        className={cx(
          '!block !w-full !items-stretch !p-6 !text-left !leading-normal !font-normal backdrop-blur-2xl backdrop-saturate-[1.8] transition-shadow duration-200 sm:!p-7',
          tone === 'call' ? 'shadow-call' : 'shadow-card',
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
        'rounded-card p-6 transition-[background-color,box-shadow] duration-200 ease-std sm:p-7',
        TONES[tone],
        className,
      )}
    >
      {body}
    </section>
  )
}
