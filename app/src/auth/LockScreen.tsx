import { useEffect, useRef, useState, type FormEvent } from 'react'
import { motion, useAnimationControls } from 'motion/react'
import { BlurReveal } from '../ui/BlurReveal.tsx'
import { Logo, Wordmark } from '../ui/Logo.tsx'
import { Skeleton } from '../ui/Skeleton.tsx'
import { DEMO_ACCOUNT, requestRecovery, resetPassword, signIn, signUp, verifyRecovery, warmUp } from './db.ts'
import { AUTH_INPUT, PasswordField } from './PasswordField.tsx'

type Mode = 'signin' | 'signup' | 'recover' | 'code' | 'reset'

const SUBTITLES: Record<Mode, string> = {
  signin: 'Margin calls, covered by tokens.',
  signup: 'Create an account',
  recover: 'Recover a local account',
  code: 'Demo recovery code',
  reset: 'Choose a new password',
}

const ACTIONS: Record<Mode, string> = {
  signin: 'Sign in',
  signup: 'Create account',
  recover: 'Get demo recovery code',
  code: 'Verify code',
  reset: 'Update password',
}

/** The round ink arrow that submits the form, at the end of the last field (Mac login style). */
function SubmitArrow({ label, pending, disabled }: { label: string; pending: boolean; disabled: boolean }) {
  return (
    <motion.button
      type="submit"
      aria-label={label}
      title={label}
      disabled={disabled}
      whileTap={{ scale: 0.92 }}
      className="flex size-11 items-center justify-center rounded-full bg-ink text-white transition-opacity disabled:opacity-30"
    >
      {pending ? (
        <span aria-hidden="true" className="flex gap-0.5">
          {[0, 1, 2].map((n) => (
            <span key={n} className="size-1 rounded-full bg-current motion-safe:animate-dot" style={{ animationDelay: `${n * 0.15}s` }} />
          ))}
        </span>
      ) : (
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <path d="M2 7h9M7.5 3.5 11 7l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </motion.button>
  )
}

/**
 * Arrival screen: sign in, sign up and a local password recovery, floating on the aura. Accounts
 * live in this browser (PGlite); the screen gates the demo, it does not secure the keeper.
 */
export function LockScreen({ onUnlock }: { onUnlock(email: string): void }) {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState<string>(DEMO_ACCOUNT.email)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [code, setCode] = useState('')
  const [demoCode, setDemoCode] = useState<string | null>(null)
  const [resetToken, setResetToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  // Synchronous guard: a double click or Enter never submits twice.
  const submitting = useRef(false)
  const shake = useAnimationControls()

  // The form shows a shimmering skeleton while the local database (PGlite) loads, never a spinner.
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let alive = true
    const started = Date.now()
    void warmUp().then(() => {
      window.setTimeout(() => alive && setReady(true), Math.max(0, 450 - (Date.now() - started)))
    })
    // Development-only account maintenance in the console; absent from the production bundle.
    if (import.meta.env.DEV) void import('./dev-admin.ts').then((m) => m.installDevelopmentAdmin())
    return () => {
      alive = false
    }
  }, [])

  const go = (next: Mode) => {
    setMode(next)
    setError(null)
    setNotice(null)
    setPassword('')
    setConfirmation('')
    setCode('')
    setDemoCode(null)
    setResetToken('')
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting.current) return
    submitting.current = true
    setPending(true)
    setError(null)
    setNotice(null)
    try {
      if (mode === 'recover') {
        const result = await requestRecovery(email)
        if (!result.ok) return setError(result.error)
        setEmail(result.email)
        setDemoCode(result.demoCode ?? null)
        setMode('code')
        return
      }
      if (mode === 'code') {
        const result = await verifyRecovery(email, code)
        if (!result.ok) return setError(result.error)
        setDemoCode(null)
        setCode('')
        setResetToken(result.resetToken!)
        setMode('reset')
        return
      }
      const result =
        mode === 'signin'
          ? await signIn(email, password)
          : mode === 'signup'
            ? await signUp(email, password, confirmation)
            : await resetPassword(email, resetToken, password, confirmation)
      if (result.ok) {
        if (mode === 'reset') {
          go('signin')
          setNotice('Password updated. Sign in with your new password.')
        } else onUnlock(result.email)
        return
      }
      setError(result.error)
      if (mode === 'signin') setPassword('')
      // Refused: the fields shake, like the Mac login.
      void shake.start({ x: [0, -12, 10, -8, 6, -3, 0], transition: { duration: 0.45 } })
    } catch {
      setError('The local database could not open. Reload the page.')
    } finally {
      submitting.current = false
      setPending(false)
    }
  }

  const recovering = mode === 'recover' || mode === 'code' || mode === 'reset'
  const filled =
    mode === 'signin'
      ? email !== '' && password !== ''
      : mode === 'signup' || mode === 'reset'
        ? password !== '' && confirmation !== ''
        : mode === 'recover'
          ? email !== ''
          : code !== ''
  const arrow = <SubmitArrow label={ACTIONS[mode]} pending={pending} disabled={pending || !filled} />

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex flex-col items-center overflow-y-auto px-4 py-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04, filter: 'blur(12px)' }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* No panel: the mark, the name and the fields float on the aura, large, like an arrival page. */}
      <div className="my-auto flex w-full max-w-lg flex-col items-center">
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center"
        >
          <Logo height={120} className="h-[clamp(5rem,15svh,8.5rem)] w-auto" />
          <h1 className="mt-[clamp(1.25rem,4svh,2.5rem)] text-[clamp(2rem,4.6vw,3.5rem)] leading-none text-ink">
            <Wordmark />
          </h1>
          <p className="text-lead mt-4 min-h-[1.5em] text-ink-muted">
            {mode === 'signin' ? SUBTITLES.signin : <BlurReveal text={SUBTITLES[mode]} />}
          </p>
        </motion.div>

        {!ready ? (
          <LockSkeleton />
        ) : (
          <>
            {recovering && (
              <p className="mt-5 max-w-sm text-center text-xs text-ink-subtle">
                No email is sent. Recovery only changes an account stored in this browser; it is not production security.
              </p>
            )}
            {mode === 'code' && (
              <div className="mt-6 text-center">
                {demoCode ? (
                  <>
                    <p className="text-sm text-ink-muted">Code for {email}</p>
                    <p className="mt-2 font-mono text-3xl tracking-[0.3em] break-all" data-testid="demo-code">
                      {demoCode}
                    </p>
                    <p className="mt-2 text-xs text-ink-subtle">Valid for 10 minutes · single use · 5 attempts.</p>
                  </>
                ) : (
                  <p className="text-sm text-ink-muted">
                    No matching local recovery code is available in this browser. Check the email or create a local account.
                  </p>
                )}
              </div>
            )}

            <motion.form
              animate={shake}
              onSubmit={submit}
              className="mt-[clamp(2rem,6svh,3.5rem)] w-full"
              noValidate
              aria-busy={pending}
            >
              <fieldset disabled={pending} className="grid gap-4">
                {(mode === 'signin' || mode === 'signup' || mode === 'recover') && (
                  <div className="relative">
                    <label className="sr-only" htmlFor="lock-email">
                      Email
                    </label>
                    <input
                      id="lock-email"
                      type="email"
                      autoComplete="username"
                      placeholder="Email"
                      value={email}
                      autoFocus={mode !== 'signin'}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`${AUTH_INPUT} ${mode === 'recover' ? '!pr-16 !pl-16' : ''}`}
                    />
                    {mode === 'recover' && <div className="absolute top-2.5 right-2.5">{arrow}</div>}
                  </div>
                )}
                {(mode === 'signin' || mode === 'signup' || mode === 'reset') && (
                  <PasswordField
                    key={`${mode}-password`}
                    label={mode === 'signin' ? 'Password' : 'New password'}
                    value={password}
                    onChange={setPassword}
                    autoFocus={mode === 'signin' || mode === 'reset'}
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    trailing={mode === 'signin' ? arrow : undefined}
                  />
                )}
                {(mode === 'signup' || mode === 'reset') && (
                  <>
                    <PasswordField
                      key={`${mode}-confirmation`}
                      label="Confirm password"
                      value={confirmation}
                      onChange={setConfirmation}
                      autoComplete="new-password"
                      trailing={arrow}
                    />
                    <p className="px-2 text-center text-xs text-ink-subtle">Use at least 10 characters. A passphrase works well.</p>
                  </>
                )}
                {mode === 'code' && (
                  <div className="relative">
                    <label className="sr-only" htmlFor="recovery-code">
                      Recovery code
                    </label>
                    <input
                      id="recovery-code"
                      autoComplete="one-time-code"
                      placeholder="Recovery code"
                      value={code}
                      autoFocus
                      onChange={(e) => setCode(e.target.value)}
                      className={`${AUTH_INPUT} !pr-16 !pl-16`}
                    />
                    <div className="absolute top-2.5 right-2.5">{arrow}</div>
                  </div>
                )}
              </fieldset>
            </motion.form>

            <p role="alert" className="mt-4 min-h-5 text-center text-sm text-danger">
              {error}
            </p>
            {notice && (
              <p role="status" className="text-center text-sm text-success">
                {notice}
              </p>
            )}

            <div className="mt-2 flex flex-col items-center gap-2.5 text-[0.9375rem]">
              {mode === 'signin' && (
                <button type="button" disabled={pending} onClick={() => go('recover')} className="text-ink-muted hover:text-ink">
                  Forgot password?
                </button>
              )}
              {mode === 'code' && (
                <button type="button" disabled={pending} onClick={() => go('recover')} className="text-ink-muted hover:text-ink">
                  Request a new code
                </button>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  go(mode === 'signin' ? 'signup' : 'signin')
                  if (mode === 'signin') setEmail('')
                }}
                className="font-medium text-ink hover:underline"
              >
                {mode === 'signin' ? 'Create an account' : 'Back to sign in'}
              </button>
              {!recovering && (
                <p className="mt-3 text-xs text-ink-subtle">
                  Demo: {DEMO_ACCOUNT.email} · {DEMO_ACCOUNT.password}
                </p>
              )}
              <p className="mt-1 max-w-sm text-center text-xs text-ink-subtle">
                Accounts are stored in this browser only. This screen does not secure the keeper.
              </p>
            </div>
          </>
        )}
      </div>
    </motion.div>
  )
}

/** Same footprint as the form, so nothing moves when the database is ready. */
function LockSkeleton() {
  return (
    <div role="status" aria-label="Opening the local database" className="mt-[clamp(2rem,6svh,3.5rem)] grid w-full gap-4">
      <Skeleton className="h-16 w-full rounded-full" />
      <Skeleton className="h-16 w-full rounded-full" />
      <div className="mt-6 grid justify-items-center gap-3">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-3 h-3 w-44" />
      </div>
    </div>
  )
}
