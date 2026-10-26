// Imported only under import.meta.env.DEV; absent from the production bundle.
import { DEMO_ACCOUNT, developmentDatabase, durable, normalizeEmail, passwordError, passwordRecord } from './db.ts'
import { rememberUser } from './session.ts'

const CONFIRM = 'RESET LOCAL DEMO ACCOUNTS'
function developmentOnly() {
  if (!import.meta.env.DEV) throw new Error('Local account administration is development-only.')
}
const admin = {
  async list() {
    developmentOnly()
    return (await (await developmentDatabase()).query<{ email: string; created_at: string }>(
      'SELECT email, created_at FROM users ORDER BY email')).rows
  },
  async resetPassword(email: string, password: string) {
    developmentOnly()
    const error = passwordError(password, password)
    if (error) throw new Error(error)
    const record = await passwordRecord(password)
    return durable(async (tx) => {
      const result = await tx.query('UPDATE users SET salt = $2, hash = $3 WHERE email = $1', [normalizeEmail(email), record.salt, record.hash])
      await tx.query('DELETE FROM recovery WHERE email = $1', [normalizeEmail(email)])
      rememberUser(null)
      return result.affectedRows === 1
    })
  },
  async deleteAccount(email: string) {
    developmentOnly()
    const result = await (await developmentDatabase()).query('DELETE FROM users WHERE email = $1', [normalizeEmail(email)])
    rememberUser(null)
    return result.affectedRows === 1
  },
  async resetDatabase(confirmation: string) {
    developmentOnly()
    if (confirmation !== CONFIRM) throw new Error(`Confirm with: ${CONFIRM}`)
    const record = await passwordRecord(DEMO_ACCOUNT.password)
    await durable(async (tx) => {
      await tx.query('DELETE FROM recovery')
      await tx.query('DELETE FROM users')
      await tx.query('INSERT INTO users(email, salt, hash) VALUES($1, $2, $3)', [DEMO_ACCOUNT.email, record.salt, record.hash])
    })
    rememberUser(null)
  },
}
export function installDevelopmentAdmin() {
  developmentOnly()
  Object.assign(window, { keystoneDemoAccounts: admin })
}
