import type { ReactNode } from 'react'
import StarBorder from './bits/StarBorder.tsx'
import { cx } from './cx.ts'

type Tone = 'default' | 'call' | 'default-settled' | 'bare'

// Frosted glass panels. Only the margin-call panel is tinted (sober red), like Flighty's single alert.
const TONES: Record<Tone, string> = {
  default: 'glass shadow-card',
  call: 'glass !bg-warning-tint shadow-call',
  'default-settled': 'glass shadow-card',
  // No panel of its own: a section of a larger glass panel, set apart by whitespace.
  bare: '',
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
        <header className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-40 flex-1">
            {title && <h2 className="label-caps">{title}</h2>}
            {description && <p className="mt-1.5 text-sm text-ink-subtle">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </>
  )

  if (starCapable) {
    const lit = star && tone === 'call'
    const bare = tone === 'bare'
    return (
      <StarBorder
        as="section"
        theme="light"
        radius={32}
        thickness={1}
        duration={4}
        glow={lit ? 0.4 : 0}
        trailLength={lit ? 0.25 : 0}
        color={lit ? '#c0362b' : 'transparent'}
        trailColor={lit ? '#c0362b' : 'transparent'}
        borderColor={tone === 'call' ? 'rgba(192, 54, 43, 0.35)' : bare ? 'transparent' : 'rgba(255, 255, 255, 0.45)'}
        backgroundColor={tone === 'call' ? 'rgba(255, 235, 233, 0.5)' : bare ? 'transparent' : 'rgba(255, 255, 255, 0.3)'}
        textColor="#1c1c1e"
        hover="none"
        clickPulse={false}
        className={cx(
          '!block !w-full !items-stretch !text-left !leading-normal !font-normal transition-shadow duration-200',
          bare ? '!p-0' : '!p-7 backdrop-blur-lg backdrop-saturate-150 sm:!p-8',
          tone === 'call' ? 'shadow-call' : bare ? '' : 'shadow-card',
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
        'transition-[background-color,box-shadow] duration-200 ease-std',
        tone === 'bare' ? '' : 'rounded-card p-7 sm:p-8',
        TONES[tone],
        className,
      )}
    >
      {body}
    </section>
  )
}
