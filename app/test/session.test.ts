import { afterEach, expect, it, vi } from 'vitest'
import { currentUser, rememberUser } from '../src/auth/session.ts'

afterEach(() => vi.unstubAllGlobals())
it('persists across module reload in the tab and clears on logout', async () => {
  const store = new Map<string, string>()
  vi.stubGlobal('sessionStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) })
  expect(currentUser()).toBeNull()
  rememberUser('demo@keystone.app')
  vi.resetModules()
  expect((await import('../src/auth/session.ts')).currentUser()).toBe('demo@keystone.app')
  rememberUser(null)
  expect(currentUser()).toBeNull()
})
it('fails closed when browser storage is blocked', () => {
  vi.stubGlobal('sessionStorage', { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') }, removeItem: () => { throw new Error('blocked') } })
  expect(currentUser()).toBeNull()
  expect(() => rememberUser('demo@keystone.app')).not.toThrow()
  expect(() => rememberUser(null)).not.toThrow()
})
