import { useId, useState, type ReactNode } from 'react'

/** The lock screen's floating glass field: large, centered text, no panel around it. */
export const AUTH_INPUT =
  'glass h-16 w-full rounded-full px-6 text-center text-lg text-ink shadow-card outline-transparent transition-shadow placeholder:text-ink-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chain'

/** Password field with its own show/hide eye; `trailing` (the submit arrow) sits after the eye. */
export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  autoFocus = false,
  trailing,
}: {
  label: string
  value: string
  onChange(value: string): void
  autoComplete: 'current-password' | 'new-password'
  autoFocus?: boolean
  trailing?: ReactNode
}) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        placeholder={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // Symmetric padding keeps the text centered; narrow screens give the left side back to the text.
        className={`${AUTH_INPUT} ${trailing ? '!pr-28 !pl-6 sm:!pl-28' : '!pr-16 !pl-6 sm:!pl-16'}`}
      />
      <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
        <button
          type="button"
          aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
          className="flex size-11 items-center justify-center rounded-full text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-chain"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
            {visible && <path d="m3 3 18 18" />}
          </svg>
        </button>
        {trailing}
      </div>
    </div>
  )
}
