// Accounts for the lock screen, in PostgreSQL (PGlite: PostgreSQL compiled to WebAssembly,
// persisted in this browser's IndexedDB). Loaded lazily, only for the lock screen.
//
// Limit (by design, decided for the demo): this database lives in the visitor's browser. It gates
// the demo screen; it is not a security boundary, and accounts are not shared between browsers.
import type { PGlite, Transaction } from '@electric-sql/pglite'

/** Default account, so the demo can be opened without signing up. */
export const DEMO_ACCOUNT = { email: 'demo@keystone.app', password: 'stellar' } as const

const ITERATIONS = 210_000

let dbPromise: Promise<PGlite> | null = null

function hex(bytes: ArrayBuffer | Uint8Array): string {
  return Array.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(text: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(text.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(text.slice(i * 2, i * 2 + 2), 16)
  return out
}

/** PBKDF2-SHA256 of the password with the given salt: passwords are never stored in clear. */
async function derive(password: string, salt: Uint8Array<ArrayBuffer>): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, key, 256)
  return hex(bits)
}

/** Constant-time comparison of two hex strings of equal length. */
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function insertUser(db: PGlite, email: string, password: string): Promise<boolean> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derive(password, salt)
  const result = await db.query('INSERT INTO users (email, salt, hash) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING', [
    email,
    hex(salt),
    hash,
  ])
  return (result.affectedRows ?? 0) > 0
}

async function open(): Promise<PGlite> {
  const { PGlite } = await import('@electric-sql/pglite')
  // Private mode or blocked storage: fall back to a database kept in memory for this tab, so the demo
  // account still opens (accounts created then are lost on reload).
  const db = await PGlite.create('idb://keystone-auth').catch(() => PGlite.create())
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      email      text PRIMARY KEY,
      salt       text NOT NULL,
      hash       text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS recovery (
      email text PRIMARY KEY REFERENCES users(email) ON DELETE CASCADE,
      code_hash text,
      token_hash text,
      expires_at bigint NOT NULL,
      attempts integer NOT NULL DEFAULT 0
    );
  `)
  await insertUser(db, DEMO_ACCOUNT.email, DEMO_ACCOUNT.password)
  return db
}

function db(): Promise<PGlite> {
  dbPromise ??= open().catch((error) => {
    dbPromise = null
    throw error
  })
  return dbPromise
}

/**
 * A transaction written through to IndexedDB before it resolves. PGlite flushes to storage after
 * `query()`, but not after `transaction()`: without this, a reload right after a password reset
 * lost the new password.
 */
export async function durable<T>(run: (tx: Transaction) => Promise<T>): Promise<T> {
  const database = await db()
  const result = await database.transaction(run)
  await database.syncToFs()
  return result
}

/** Starts loading the database early (the lock screen calls it on mount). */
export function warmUp(): Promise<void> {
  return db().then(
    () => undefined,
    () => undefined,
  )
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export type AuthResult = { ok: true; email: string } | { ok: false; error: string }

export async function signIn(emailInput: string, password: string): Promise<AuthResult> {
  const email = normalizeEmail(emailInput)
  if (!validEmail(email) || !password) return { ok: false, error: 'Enter a valid email and password.' }
  const result = await (await db()).query<{ salt: string; hash: string }>('SELECT salt, hash FROM users WHERE email = $1', [email])
  const row = result.rows[0]
  // Derive even for an unknown email, so both failures take the same time and read the same.
  const hash = await derive(password, row ? fromHex(row.salt) : new Uint8Array(16))
  if (!row || !same(hash, row.hash)) return { ok: false, error: 'Wrong email or password.' }
  return { ok: true, email }
}

export function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email))
}

export function passwordError(password: string, confirmation: string): string | null {
  if (password.length < 10) return 'Use at least 10 characters.'
  if (password !== confirmation) return 'Passwords do not match.'
  return null
}

export async function signUp(emailInput: string, password: string, confirmation = password): Promise<AuthResult> {
  const email = normalizeEmail(emailInput)
  if (!validEmail(email)) return { ok: false, error: 'Enter a valid email.' }
  const error = passwordError(password, confirmation)
  if (error) return { ok: false, error }
  const created = await insertUser(await db(), email, password)
  if (!created) return { ok: false, error: 'An account already exists for this email.' }
  return { ok: true, email }
}

export const RECOVERY_TTL_MS = 10 * 60_000
export const RECOVERY_ATTEMPTS = 5
const randomToken = () => hex(crypto.getRandomValues(new Uint8Array(24)))
const digest = async (value: string) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))
const invalidRecovery = 'Invalid, expired or already used recovery code. Request a new code.'

/** Local demonstration only: possession of this browser's database is the trust boundary.
 * No email is sent. Only a matching local account receives a displayed code. */
export async function requestRecovery(emailInput: string): Promise<AuthResult & { demoCode?: string }> {
  const email = normalizeEmail(emailInput)
  if (!validEmail(email)) return { ok: false, error: 'Enter a valid email.' }
  const code = hex(crypto.getRandomValues(new Uint8Array(6))).toUpperCase()
  const result = await (await db()).query(`
    INSERT INTO recovery (email, code_hash, expires_at)
    SELECT email, $2, $3 FROM users WHERE email = $1
    ON CONFLICT (email) DO UPDATE SET code_hash = $2, token_hash = NULL, expires_at = $3, attempts = 0
    RETURNING email`, [email, await digest(code), Date.now() + RECOVERY_TTL_MS])
  return { ok: true, email, ...(result.rows.length ? { demoCode: code } : {}) }
}

export async function verifyRecovery(emailInput: string, codeInput: string): Promise<AuthResult & { resetToken?: string }> {
  const email = normalizeEmail(emailInput)
  const codeHash = await digest(codeInput.trim().toUpperCase())
  return durable(async (tx) => {
    const result = await tx.query<{ code_hash: string | null; expires_at: string; attempts: number }>(
      'SELECT code_hash, expires_at, attempts FROM recovery WHERE email = $1 FOR UPDATE', [email])
    const row = result.rows[0]
    if (!row || !row.code_hash || Number(row.expires_at) <= Date.now() || row.attempts >= RECOVERY_ATTEMPTS) {
      return { ok: false as const, error: invalidRecovery }
    }
    await tx.query('UPDATE recovery SET attempts = attempts + 1 WHERE email = $1', [email])
    if (!same(codeHash, row.code_hash)) return { ok: false as const, error: invalidRecovery }
    const resetToken = randomToken()
    // Consume the code immediately. The short-lived reset grant is also single-use.
    await tx.query('UPDATE recovery SET code_hash = NULL, token_hash = $2 WHERE email = $1', [email, await digest(resetToken)])
    return { ok: true as const, email, resetToken }
  })
}

export async function resetPassword(emailInput: string, resetToken: string, password: string, confirmation: string): Promise<AuthResult> {
  const error = passwordError(password, confirmation)
  if (error) return { ok: false, error }
  const email = normalizeEmail(emailInput)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derive(password, salt)
  const tokenHash = await digest(resetToken)
  return durable(async (tx) => {
    const result = await tx.query<{ token_hash: string | null; expires_at: string }>(
      'SELECT token_hash, expires_at FROM recovery WHERE email = $1 FOR UPDATE', [email])
    const row = result.rows[0]
    if (!row?.token_hash || Number(row.expires_at) <= Date.now() || !same(tokenHash, row.token_hash)) {
      return { ok: false as const, error: invalidRecovery }
    }
    await tx.query('UPDATE users SET salt = $2, hash = $3 WHERE email = $1', [email, hex(salt), hash])
    await tx.query('DELETE FROM recovery WHERE email = $1', [email])
    return { ok: true as const, email }
  })
}

// Imported only by the dynamically loaded development admin module; never exposes hashes in UI.
export const developmentDatabase = db
export async function passwordRecord(password: string): Promise<{ salt: string; hash: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return { salt: hex(salt), hash: await derive(password, salt) }
}
