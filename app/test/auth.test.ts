import { afterAll, describe, expect, it, vi } from 'vitest'
import { DEMO_ACCOUNT, developmentDatabase, RECOVERY_ATTEMPTS, RECOVERY_TTL_MS, requestRecovery, resetPassword, signIn, signUp, verifyRecovery } from '../src/auth/db.ts'
import { installDevelopmentAdmin } from '../src/auth/dev-admin.ts'

const password = 'a sufficiently long passphrase'
const email = 'test@example.com'
afterAll(async () => { vi.restoreAllMocks(); vi.unstubAllGlobals(); await (await developmentDatabase()).close() })

describe('existing local accounts and signup', () => {
  it('keeps the original demo password and rejects wrong/nonexistent credentials generically', async () => {
    expect(await signIn(DEMO_ACCOUNT.email, DEMO_ACCOUNT.password)).toMatchObject({ ok: true })
    const wrong = await signIn(DEMO_ACCOUNT.email, 'wrong')
    expect(wrong.ok).toBe(false)
    expect(await signIn('unknown@example.com', 'wrong')).toEqual(wrong)
  })
  it('normalizes email, enforces database uniqueness even concurrently and never stores cleartext passwords', async () => {
    expect(await signUp(' Test@Example.COM ', password, password)).toEqual({ ok: true, email })
    expect(await signIn(email.toUpperCase(), password)).toMatchObject({ ok: true })
    expect(await signUp(email, password)).toMatchObject({ ok: false, error: expect.stringContaining('already exists') })
    const results = await Promise.all([signUp('race@example.com', password), signUp(' RACE@example.com ', password)])
    expect(results.filter((r) => r.ok)).toHaveLength(1)
    const rows = await (await developmentDatabase()).query<{ hash: string; salt: string }>('SELECT hash, salt FROM users')
    expect(rows.rows.every((r) => r.hash.length === 64 && r.salt.length === 32 && r.hash !== password)).toBe(true)
  })
  it('rejects invalid email, short passwords and mismatched confirmation; accepts long passphrases', async () => {
    expect((await signUp('bad', password)).ok).toBe(false)
    expect((await signUp('weak@example.com', 'short')).ok).toBe(false)
    expect((await signUp('mismatch@example.com', password, 'different')).ok).toBe(false)
    expect((await signUp('long@example.com', 'x'.repeat(300))).ok).toBe(true)
  })
  it('authenticates a pre-upgrade six-character account without upgrading its password policy', async () => {
    const db = await developmentDatabase()
    // The existing demo has the same pre-upgrade PBKDF2 format and short password.
    await db.query("INSERT INTO users(email,salt,hash) SELECT 'legacy@example.com',salt,hash FROM users WHERE email=$1", [DEMO_ACCOUNT.email])
    expect((await signIn('legacy@example.com', 'stellar')).ok).toBe(true)
  })
})

describe('single-use local recovery', () => {
  it('does not issue a code for an absent local account or an invalid address', async () => {
    expect(await requestRecovery('missing@example.com')).toEqual({ ok: true, email: 'missing@example.com' })
    expect((await requestRecovery('bad')).ok).toBe(false)
  })
  it('rejects wrong codes then consumes a correct code; reset accepts only one grant, changes the password', async () => {
    const request = await requestRecovery(email)
    expect(request.demoCode).toMatch(/^[A-F0-9]{12}$/)
    expect((await verifyRecovery(email, 'wrong')).ok).toBe(false)
    const verified = await verifyRecovery(email, request.demoCode!)
    expect(verified.ok).toBe(true)
    expect((await verifyRecovery(email, request.demoCode!)).ok).toBe(false)
    expect((await resetPassword(email, 'forged', password, password)).ok).toBe(false)
    expect((await resetPassword(email, verified.resetToken!, 'short', 'short')).ok).toBe(false)
    expect((await resetPassword(email, verified.resetToken!, password, 'different')).ok).toBe(false)
    const next = 'new password for recovery'
    const results = await Promise.all([resetPassword(email, verified.resetToken!, next, next), resetPassword(email, verified.resetToken!, next, next)])
    expect(results.filter((r) => r.ok)).toHaveLength(1)
    expect((await signIn(email, password)).ok).toBe(false)
    expect((await signIn(email, next)).ok).toBe(true)
    expect((await verifyRecovery(email, request.demoCode!)).ok).toBe(false)
  })
  it('limits verification attempts, including the correct code after the limit', async () => {
    const request = await requestRecovery(email)
    for (let i = 0; i < RECOVERY_ATTEMPTS; i++) expect((await verifyRecovery(email, 'wrong')).ok).toBe(false)
    expect((await verifyRecovery(email, request.demoCode!)).ok).toBe(false)
  })
  it('expires at the exact deadline, including a previously verified reset grant', async () => {
    const request = await requestRecovery(email)
    const clock = vi.spyOn(Date, 'now')
    const now = Date.now()
    clock.mockReturnValue(now + RECOVERY_TTL_MS)
    expect((await verifyRecovery(email, request.demoCode!)).ok).toBe(false)
    clock.mockRestore()
    const second = await requestRecovery(email)
    const verified = await verifyRecovery(email, second.demoCode!)
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + RECOVERY_TTL_MS)
    expect((await resetPassword(email, verified.resetToken!, password, password)).ok).toBe(false)
    vi.restoreAllMocks()
  })
  it('resending invalidates previous codes and outstanding reset grants', async () => {
    const first = await requestRecovery(email)
    const grant = await verifyRecovery(email, first.demoCode!)
    const second = await requestRecovery(email)
    expect(second.demoCode).not.toBe(first.demoCode)
    expect((await resetPassword(email, grant.resetToken!, password, password)).ok).toBe(false)
    expect((await verifyRecovery(email, first.demoCode!)).ok).toBe(false)
    expect((await verifyRecovery(email, second.demoCode!)).ok).toBe(true)
  })
})

it('development maintenance lists no hashes, invalidates recovery, deletes and requires explicit database reset confirmation', async () => {
  const localWindow: { keystoneDemoAccounts?: {
    list(): Promise<{ email: string; created_at: string }[]>;
    resetPassword(email: string, password: string): Promise<boolean>;
    deleteAccount(email: string): Promise<boolean>;
    resetDatabase(confirmation: string): Promise<void>;
  } } = {}
  vi.stubGlobal('window', localWindow)
  installDevelopmentAdmin()
  const admin = localWindow.keystoneDemoAccounts!
  await signUp('admin-test@example.com', password)
  const request = await requestRecovery('admin-test@example.com')
  expect((await admin.list()).every((row) => Object.keys(row).sort().join(',') === 'created_at,email')).toBe(true)
  expect(await admin.resetPassword('admin-test@example.com', 'changed by development admin')).toBe(true)
  expect((await verifyRecovery('admin-test@example.com', request.demoCode!)).ok).toBe(false)
  expect((await signIn('admin-test@example.com', 'changed by development admin')).ok).toBe(true)
  expect(await admin.deleteAccount('admin-test@example.com')).toBe(true)
  expect((await signIn('admin-test@example.com', 'changed by development admin')).ok).toBe(false)
  await expect(admin.resetDatabase('no')).rejects.toThrow('Confirm with:')
  expect((await admin.list()).length).toBeGreaterThan(1)
  await admin.resetDatabase('RESET LOCAL DEMO ACCOUNTS')
  expect((await admin.list()).map((u) => u.email)).toEqual([DEMO_ACCOUNT.email])
  expect((await signIn(DEMO_ACCOUNT.email, DEMO_ACCOUNT.password)).ok).toBe(true)
})

