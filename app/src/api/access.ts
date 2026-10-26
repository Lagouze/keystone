// The team access code that authorizes writes on a hosted keeper. It is typed by the person, kept in
// this browser only, and sent as `Authorization: Bearer`. It is never part of the build.
const KEY = 'keystone.accessCode'
let memory: string | null = null

export function getAccessCode(): string | null {
  try {
    return localStorage.getItem(KEY) ?? memory
  } catch {
    return memory
  }
}

export function setAccessCode(code: string | null): void {
  memory = code
  try {
    if (code) localStorage.setItem(KEY, code)
    else localStorage.removeItem(KEY)
  } catch {
    // Storage blocked: the code then lives until the tab is closed.
  }
}
