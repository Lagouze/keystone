import { useEffect, useState, type FormEvent } from 'react'
import { motion, useAnimationControls } from 'motion/react'
import { BlurReveal } from '../ui/BlurReveal.tsx'
import { Logo, Wordmark } from '../ui/Logo.tsx'
import { Skeleton } from '../ui/Skeleton.tsx'
import { DEMO_ACCOUNT, signIn, signUp, warmUp } from './db.ts'

type Mode = 'signin' | 'signup'

export function LockScreen({ onUnlock }: { onUnlock(email: string): void }) {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState<string>(DEMO_ACCOUNT.email)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [forgot, setForgot] = useState(false)
  const shake = useAnimationControls()

  // The form shows a shimmering skeleton while the local database (PGlite) loads, never a spinner.
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let alive = true
    const started = Date.now()
    void warmUp().then(() => {
      window.setTimeout(() => alive && setReady(true), Math.max(0, 450 - (Date.now() - started)))
    })
    return () => {
      alive = false
    }
  }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError(null)
    try {
      const result = mode === 'signin' ? await signIn(email, password) : await signUp(email, password)
      if (result.ok) {
        onUnlock(result.email)
        return
      }
      setError(result.error)
      setPassword('')
      // Wrong password: the field shakes, like the Mac login.
      void shake.start({ x: [0, -12, 10, -8, 6, -3, 0], transition: { duration: 0.45 } })
    } catch {
      setError('The local database could not open. Reload the page.')
    } finally {
      setPending(false)
    }
  }

  const switchMode = () => {
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'))
    setError(null)
    setPassword('')
    if (mode === 'signin') setEmail('')
  }

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
            {mode === 'signin' ? 'Margin calls, covered by tokens.' : <BlurReveal text="Create an account" />}
          </p>
        </motion.div>

        {!ready ? (
          <LockSkeleton />
        ) : (
          <>
        <motion.form animate={shake} onSubmit={submit} className="mt-[clamp(2rem,6svh,3.5rem)] grid w-full gap-4" noValidate>
          <label className="sr-only" htmlFor="lock-email">
            Email
          </label>
          <input
            id="lock-email"
            type="email"
            autoComplete="username"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="glass h-16 w-full rounded-full px-6 text-center text-lg shadow-card text-ink outline-transparent transition-shadow placeholder:text-ink-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chain"
          />
          <div className="relative">
            <label className="sr-only" htmlFor="lock-password">
              Password
            </label>
            <input
              id="lock-password"
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              placeholder={mode === 'signin' ? 'Enter Password' : 'Choose a password'}
              value={password}
              autoFocus
              onChange={(e) => setPassword(e.target.value)}
              className="glass h-16 w-full rounded-full pr-20 pl-6 text-center text-lg shadow-card text-ink outline-transparent transition-shadow placeholder:text-ink-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chain"
            />
            <motion.button
              type="submit"
              aria-label={mode === 'signin' ? 'Sign in' : 'Create account'}
              disabled={pending || !password}
              whileTap={{ scale: 0.92 }}
              className="absolute top-2.5 right-2.5 flex size-11 items-center justify-center rounded-full bg-ink text-white transition-opacity disabled:opacity-30"
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
          </div>
        </motion.form>

        <p role="alert" className="mt-4 min-h-5 text-center text-sm text-danger">
          {error}
        </p>

        <div className="mt-2 flex flex-col items-center gap-2.5 text-[0.9375rem]">
          {mode === 'signin' && (
            <button type="button" onClick={() => setForgot(true)} className="text-ink-muted hover:text-ink">
              Forgot password?
            </button>
          )}
          {forgot && mode === 'signin' && (
            <p className="text-xs text-ink-subtle">Password reset is not available in this demo.</p>
          )}
          <button type="button" onClick={switchMode} className="font-medium text-ink hover:underline">
            {mode === 'signin' ? 'Create an account' : 'I already have an account'}
          </button>
          <p className="mt-3 text-xs text-ink-subtle">
            Demo: {DEMO_ACCOUNT.email} · {DEMO_ACCOUNT.password}
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
