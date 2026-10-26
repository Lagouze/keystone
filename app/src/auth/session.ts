// Who unlocked the demo in this tab. sessionStorage: closing the tab locks it again. Any storage
// error (private mode, blocked storage) simply means "locked".
const KEY = 'keystone.user'

export function currentUser(): string | null {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function rememberUser(email: string | null): void {
  try {
    if (email) sessionStorage.setItem(KEY, email)
    else sessionStorage.removeItem(KEY)
  } catch {
    // Not remembered: the lock screen shows again on reload.
  }
}
