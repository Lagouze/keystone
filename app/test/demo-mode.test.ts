import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

async function configFor(search: string | null) {
  vi.resetModules()
  if (search !== null) vi.stubGlobal('window', { location: { search } })
  return import('../src/config.ts')
}

describe('?demo', () => {
  it('turns the mock keeper on for that visit only', async () => {
    expect((await configFor('?demo')).USE_MOCKS).toBe(true)
    expect((await configFor('?foo=1&demo')).USE_MOCKS).toBe(true)
  })

  it('leaves the real keeper alone otherwise', async () => {
    expect((await configFor('')).USE_MOCKS).toBe(false)
    expect((await configFor('?demonstration=1')).DEMO_REQUESTED).toBe(false)
    expect((await configFor(null)).USE_MOCKS).toBe(false) // no window at all (tests, server)
  })
})
