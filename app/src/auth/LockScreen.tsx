import { useEffect, useState, type FormEvent } from 'react'
import { motion, useAnimationControls } from 'motion/react'
import { BlurReveal } from '../ui/BlurReveal.tsx'
import { Logo } from '../ui/Logo.tsx'
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

  useEffect(() => warmUp(), [])

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
      <div className="glass-heavy gpu my-auto w-full max-w-md rounded-[2.5rem] px-8 pt-12 pb-9 shadow-card sm:px-12">
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center"
        >
          <Logo size={168} animated />
          <h1 className="mt-6 text-3xl font-light tracking-[0.06em] text-ink">
            <BlurReveal key={mode} text={mode === 'signin' ? 'Keystone' : 'Create an account'} />
          </h1>
        </motion.div>

        <motion.form animate={shake} onSubmit={submit} className="mt-8 grid w-full gap-3" noValidate>
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
            className="h-14 w-full rounded-full bg-white/45 px-5 text-center text-base text-ink shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6)] outline-transparent transition-shadow placeholder:text-ink-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chain"
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
              className="h-14 w-full rounded-full bg-white/45 pr-16 pl-5 text-center text-base text-ink shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6)] outline-transparent transition-shadow placeholder:text-ink-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chain"
            />
            <motion.button
              type="submit"
              aria-label={mode === 'signin' ? 'Sign in' : 'Create account'}
              disabled={pending || !password}
              whileTap={{ scale: 0.92 }}
              className="absolute top-2 right-2 flex size-10 items-center justify-center rounded-full bg-ink text-white transition-opacity disabled:opacity-30"
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
