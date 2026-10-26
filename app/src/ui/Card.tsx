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
   * never remounts the content (focus, running animations). The travelling light and the border are off:
   * panels have no contour.
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
    return (
      <StarBorder
        as="section"
        theme="light"
        radius={32}
        thickness={1}
        duration={4}
        glow={0}
        trailLength={0}
        color="transparent"
        trailColor="transparent"
        borderColor="transparent"
        backgroundColor={tone === 'call' ? 'rgba(255, 235, 233, 0.5)' : 'rgba(255, 255, 255, 0.3)'}
        textColor="#1c1c1e"
        hover="none"
        clickPulse={false}
        className={cx(
          '!block !w-full !items-stretch !p-7 !text-left !leading-normal !font-normal backdrop-blur-2xl backdrop-saturate-[1.7] transition-shadow duration-200 sm:!p-8',
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
        'rounded-card p-7 transition-[background-color,box-shadow] duration-200 ease-std sm:p-8',
        TONES[tone],
        className,
      )}
    >
      {body}
    </section>
  )
}
