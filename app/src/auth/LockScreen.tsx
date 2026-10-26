import { useEffect, useRef, useState, type FormEvent } from 'react'
import { motion, useAnimationControls } from 'motion/react'
import { DEMO_ACCOUNT, requestRecovery, resetPassword, signIn, signUp, verifyRecovery, warmUp } from './db.ts'
import { AUTH_INPUT, PasswordField } from './PasswordField.tsx'
import { Button } from '../ui/Button.tsx'

type Mode = 'signin' | 'signup' | 'recover' | 'code' | 'reset'
const TITLES: Record<Mode, string> = {
  signin: 'Keystone', signup: 'Create an account', recover: 'Recover local account', code: 'Demo recovery code', reset: 'Choose a new password',
}

function useClock(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

/** Existing lock screen, with explicit local-only recovery and no keeper authentication claim. */
export function LockScreen({ onUnlock }: { onUnlock(email: string): void }) {
  const now = useClock()
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
  const submitting = useRef(false)
  const shake = useAnimationControls()

  useEffect(() => {
    warmUp()
    if (import.meta.env.DEV) void import('./dev-admin.ts').then((m) => m.installDevelopmentAdmin())
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
        if (!result.ok) { setError(result.error); return }
        setEmail(result.email)
        setDemoCode(result.demoCode ?? null)
        setMode('code')
        return
      }
      if (mode === 'code') {
        const result = await verifyRecovery(email, code)
        if (!result.ok) { setError(result.error); return }
        setDemoCode(null)
        setCode('')
        setResetToken(result.resetToken!)
        setMode('reset')
        return
      }
      const result = mode === 'signin' ? await signIn(email, password)
        : mode === 'signup' ? await signUp(email, password, confirmation)
          : await resetPassword(email, resetToken, password, confirmation)
      if (result.ok) {
        if (mode === 'reset') {
          go('signin')
          setNotice('Password updated. Sign in with your new password.')
        } else onUnlock(result.email)
        return
      }
      setError(result.error)
      void shake.start({ x: [0, -12, 10, -8, 6, -3, 0], transition: { duration: 0.45 } })
    } catch {
      setError('The local database could not open. Reload the page.')
    } finally {
      submitting.current = false
      setPending(false)
    }
  }

  const action = mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account'
    : mode === 'recover' ? 'Get demo recovery code' : mode === 'code' ? 'Verify code' : 'Update password'
  const recovering = mode === 'recover' || mode === 'code' || mode === 'reset'

  return (
    <motion.div className="fixed inset-0 z-[60] flex flex-col items-center overflow-y-auto px-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.04, filter: 'blur(12px)' }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      style={{ background: 'radial-gradient(70rem 50rem at 20% 0%, #ffffff 0%, transparent 60%), radial-gradient(60rem 40rem at 90% 100%, #dfe3ea 0%, transparent 60%), linear-gradient(180deg, #eef0f4, #e3e6ec)' }}>
      <div className="mt-[9vh] text-center text-ink">
        <p className="text-lg font-medium text-ink-muted">{now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <p className="mt-1 text-8xl font-light tracking-tight">{now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
      </div>
      <div className="mt-auto mb-[8vh] flex w-full max-w-xs flex-col items-center pt-8">
        <motion.div key={mode} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex flex-col items-center">
          <div className="glass flex size-24 items-center justify-center rounded-full text-3xl font-light shadow-card" aria-hidden="true">
            {mode === 'signup' ? '+' : (email.split('@')[0] || 'K').slice(0, 2).toUpperCase()}
          </div>
          <h1 className="mt-4 text-center text-xl font-medium">{TITLES[mode]}</h1>
        </motion.div>
        <p className="mt-3 text-center text-xs text-ink-subtle">Local browser demo · accounts are not shared. This screen does not secure the keeper.</p>
        {recovering && <p className="mt-3 text-center text-xs text-ink-muted">No email is sent. Recovery only changes an account stored in this browser; it is not production security.</p>}
        {mode === 'code' && (
          <div className="glass mt-4 w-full rounded-card p-4 text-center text-sm">
            {demoCode ? <><p>Code for {email}</p><p className="mt-2 break-all font-mono text-lg tracking-widest" data-testid="demo-code">{demoCode}</p><p className="mt-2 text-xs text-ink-subtle">Valid for 10 minutes · single use · 5 attempts.</p></>
              : <p>No matching local recovery code is available in this browser. Check the email or create a local account.</p>}
          </div>
        )}
        <motion.form animate={shake} onSubmit={submit} className="mt-5 w-full" noValidate aria-busy={pending}>
          <fieldset disabled={pending} className="grid gap-2.5">
            {(mode === 'signin' || mode === 'signup' || mode === 'recover') && <>
              <label className="sr-only" htmlFor="lock-email">Email</label>
              <input id="lock-email" type="email" autoComplete="username" placeholder="Email" value={email}
                onChange={(e) => setEmail(e.target.value)} className={AUTH_INPUT} />
            </>}
            {(mode === 'signin' || mode === 'signup' || mode === 'reset') && <PasswordField key={`${mode}-password`} label="Password" value={password} onChange={setPassword} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} />}
            {(mode === 'signup' || mode === 'reset') && <>
              <PasswordField key={`${mode}-confirmation`} label="Confirm password" value={confirmation} onChange={setConfirmation} autoComplete="new-password" />
              <p className="px-2 text-center text-xs text-ink-subtle">Use at least 10 characters. A passphrase works well.</p>
            </>}
            {mode === 'code' && <>
              <label className="sr-only" htmlFor="recovery-code">Recovery code</label>
              <input id="recovery-code" autoComplete="one-time-code" placeholder="Recovery code" value={code} onChange={(e) => setCode(e.target.value)} className={AUTH_INPUT} />
            </>}
            <Button type="submit" variant="primary" busy={pending} disabled={pending}>{action}</Button>
          </fieldset>
        </motion.form>
        <p role="alert" className="mt-3 min-h-5 text-center text-sm text-danger">{error}</p>
        {notice && <p role="status" className="mt-1 text-center text-sm text-success">{notice}</p>}
        <div className="mt-2 flex flex-col items-center gap-2 text-sm">
          {mode === 'signin' && <button type="button" disabled={pending} onClick={() => go('recover')} className="text-ink-muted hover:text-ink">Forgot password?</button>}
          {mode === 'code' && <button type="button" disabled={pending} onClick={() => go('recover')} className="text-ink-muted hover:text-ink">Request a new code</button>}
          <button type="button" disabled={pending} onClick={() => { go(mode === 'signin' ? 'signup' : 'signin'); if (mode === 'signin') setEmail('') }} className="font-medium text-ink hover:underline">
            {mode === 'signin' ? 'Create an account' : 'Back to sign in'}
          </button>
          {!recovering && <p className="mt-3 text-xs text-ink-subtle">Demo: {DEMO_ACCOUNT.email} · {DEMO_ACCOUNT.password}</p>}
        </div>
      </div>
    </motion.div>
  )
}
