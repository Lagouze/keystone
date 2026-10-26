import { useId, useState } from 'react'

export const AUTH_INPUT = 'glass h-11 w-full rounded-full px-4 text-center text-sm outline-none placeholder:text-ink-subtle focus-visible:ring-2 focus-visible:ring-ink/20'

export function PasswordField({ label, value, onChange, autoComplete }: {
  label: string; value: string; onChange(value: string): void; autoComplete: 'current-password' | 'new-password'
}) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <label className="sr-only" htmlFor={id}>{label}</label>
      <input id={id} type={visible ? 'text' : 'password'} autoComplete={autoComplete} placeholder={label}
        value={value} onChange={(e) => onChange(e.target.value)} className={`${AUTH_INPUT} !pr-12`} />
      <button type="button" aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} aria-pressed={visible}
        onClick={() => setVisible((v) => !v)} className="absolute right-1 top-1 flex size-9 items-center justify-center rounded-full text-ink-muted focus-visible:outline-2">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />
          {visible && <path d="m3 3 18 18" />}
        </svg>
      </button>
    </div>
  )
}
