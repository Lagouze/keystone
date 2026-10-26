// Accounts for the lock screen, in PostgreSQL (PGlite: PostgreSQL compiled to WebAssembly,
// persisted in this browser's IndexedDB). Loaded lazily, only for the lock screen.
//
// Limit (by design, decided for the demo): this database lives in the visitor's browser. It gates
// the demo screen; it is not a security boundary, and accounts are not shared between browsers.
import type { PGlite } from '@electric-sql/pglite'

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
  const result = await (await db()).query<{ salt: string; hash: string }>('SELECT salt, hash FROM users WHERE email = $1', [email])
  const row = result.rows[0]
  // Derive even for an unknown email, so both failures take the same time and read the same.
  const hash = await derive(password, row ? fromHex(row.salt) : new Uint8Array(16))
  if (!row || !same(hash, row.hash)) return { ok: false, error: 'Wrong email or password.' }
  return { ok: true, email }
}

export async function signUp(emailInput: string, password: string): Promise<AuthResult> {
  const email = normalizeEmail(emailInput)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Enter a valid email.' }
  if (password.length < 6) return { ok: false, error: 'Use at least 6 characters.' }
  const created = await insertUser(await db(), email, password)
  if (!created) return { ok: false, error: 'An account already exists for this email.' }
  return { ok: true, email }
}
