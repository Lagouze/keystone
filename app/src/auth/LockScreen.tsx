import { useEffect, useState, type FormEvent } from 'react'
import { motion, useAnimationControls } from 'motion/react'
import { DEMO_ACCOUNT, signIn, signUp, warmUp } from './db.ts'

type Mode = 'signin' | 'signup'

function useClock(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

/** Arrival screen in the style of the Mac login: clock, avatar, one rounded field at a time. */
export function LockScreen({ onUnlock }: { onUnlock(email: string): void }) {
  const now = useClock()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState<string>(DEMO_ACCOUNT.email)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [forgot, setForgot] = useState(false)
  const shake = useAnimationControls()

  useEffect(() => warmUp(), [])

  const initials = (email.split('@')[0] || 'K').slice(0, 2).toUpperCase()

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
      className="fixed inset-0 z-[60] flex flex-col items-center overflow-y-auto px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04, filter: 'blur(12px)' }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      style={{
        background:
          'radial-gradient(70rem 50rem at 20% 0%, #ffffff 0%, transparent 60%), radial-gradient(60rem 40rem at 90% 100%, #dfe3ea 0%, transparent 60%), linear-gradient(180deg, #eef0f4, #e3e6ec)',
      }}
    >
      <div className="mt-[9vh] text-center text-ink">
        <p className="text-lg font-medium text-ink-muted">
          {now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <p className="mt-1 text-8xl font-light tracking-tight">
          {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      <div className="mt-auto mb-[12vh] flex w-full max-w-xs flex-col items-center">
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center"
        >
          <div className="glass flex size-24 items-center justify-center rounded-full text-3xl font-light shadow-card" aria-hidden="true">
            {mode === 'signin' ? initials : '+'}
          </div>
          <h1 className="mt-4 text-xl font-medium">{mode === 'signin' ? 'Keystone' : 'Create an account'}</h1>
        </motion.div>

        <motion.form animate={shake} onSubmit={submit} className="mt-5 grid w-full gap-2.5" noValidate>
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
            className="glass h-11 w-full rounded-full px-4 text-center text-sm outline-none placeholder:text-ink-subtle focus-visible:ring-2 focus-visible:ring-ink/20"
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
              className="glass h-11 w-full rounded-full pr-12 pl-4 text-center text-sm outline-none placeholder:text-ink-subtle focus-visible:ring-2 focus-visible:ring-ink/20"
            />
            <motion.button
              type="submit"
              aria-label={mode === 'signin' ? 'Sign in' : 'Create account'}
              disabled={pending || !password}
              whileTap={{ scale: 0.92 }}
              className="absolute top-1.5 right-1.5 flex size-8 items-center justify-center rounded-full bg-ink text-white transition-opacity disabled:opacity-30"
            >
              {pending ? (
                <span aria-hidden="true" className="size-3.5 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin" />
              ) : (
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                  <path d="M2 7h9M7.5 3.5 11 7l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </motion.button>
          </div>
        </motion.form>

        <p role="alert" className="mt-3 min-h-5 text-center text-sm text-danger">
          {error}
        </p>

        <div className="mt-2 flex flex-col items-center gap-2 text-sm">
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
      </div>
    </motion.div>
  )
}
