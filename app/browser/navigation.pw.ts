import { createServer, type ServerResponse } from 'node:http'
import { test, expect, type Page } from '@playwright/test'
import type { SessionState } from '@keystone/shared'
import { mockConfig, mockSessions, mockSessionActive } from '@keystone/shared/mocks'

// A disposable HTTP/SSE keeper double. It has no SDK, keys, disk or Stellar connection.
let session: SessionState | null = null
let writes: string[] = []
let rejectStart = false
const streams = new Set<ServerResponse>()
const sendState = (next: SessionState) => {
  session = next
  for (const stream of streams) stream.write(`event: state\ndata: ${JSON.stringify(next)}\n\n`)
}
const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:4178')
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization')
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return }
  const json = (status: number, data: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(data))
  }
  if (req.method === 'POST') {
    writes.push(req.url ?? '')
    if (req.url !== '/api/session') { json(405, {}); return }
    if (rejectStart) { json(503, { error: { code: 'RpcUnavailable', message: 'Fake deployment refused.' } }); return }
    let body = ''
    for await (const chunk of req) body += chunk
    const { asset } = JSON.parse(body)
    sendState({ ...mockSessionActive, sessionId: `created-${writes.length}`, vaultId: 'MOCK-NEW-VAULT', asset })
    json(200, session)
  } else if (req.url === '/api/config') {
    json(200, { ...mockConfig, backend: 'fake', writeAuth: 'none' })
  } else if (req.url === '/api/session') {
    json(session ? 200 : 404, session ?? { error: { code: 'NoSession', message: 'No session.' } })
  } else if (req.url === '/api/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' })
    res.write(': connected\n\n')
    streams.add(res)
    if (session) res.write(`event: state\ndata: ${JSON.stringify(session)}\n\n`)
    req.on('close', () => streams.delete(res))
  } else json(404, {})
})

test.beforeAll(async () => { await new Promise<void>((resolve) => server.listen(18787, '127.0.0.1', resolve)) })
test.afterAll(async () => {
  for (const stream of streams) stream.end()
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
})
test.beforeEach(async ({ context }) => {
  session = null
  writes = []
  rejectStart = false
  // Deny every non-local request, including any accidental public keeper or Stellar request.
  await context.route('**/*', (route) => {
    const host = new URL(route.request().url()).hostname
    return host === '127.0.0.1' ? route.continue() : route.abort('blockedbyclient')
  })
  await context.addInitScript(() => sessionStorage.setItem('keystone.user', 'demo@keystone.app'))
})

const home = async (page: Page) => {
  await expect(page.getByRole('button', { name: 'Accueil', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('heading', { name: 'Post tokens, not cash.' })).toBeVisible()
}
const dashboard = async (page: Page) => {
  await expect(page.getByRole('button', { name: 'Dashboard', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('button', { name: 'Details', exact: true })).toBeVisible()
}
const vault = async (page: Page, id: string) => {
  await page.getByRole('button', { name: 'Details', exact: true }).click()
  await expect(page.locator('dd[title]')).toHaveAttribute('title', id)
  await page.getByRole('button', { name: 'Close', exact: true }).click()
}

for (const status of ['active', 'margin_call', 'defaulted'] as const) {
  test(`existing ${status}: resume, home, dashboard and reload never write`, async ({ page }, testInfo) => {
    session = structuredClone(mockSessions[status])
    const original = structuredClone(session)
    await page.goto('/')
    await home(page)
    await expect(page.getByText('Stellar Testnet', { exact: true })).toBeVisible()
    await expect(page.getByText('Demo backend · fake transactions', { exact: true })).toBeVisible()
    if (status === 'active') {
      await page.screenshot({ path: testInfo.outputPath('home.png'), animations: 'disabled' })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    }
    await page.getByRole('button', { name: 'Reprendre la session' }).click()
    await dashboard(page)
    if (status === 'active') await page.screenshot({ path: testInfo.outputPath('dashboard.png'), animations: 'disabled' })
    await vault(page, original.vaultId)
    await page.getByRole('button', { name: 'Accueil', exact: true }).click()
    await home(page)
    await page.getByRole('button', { name: 'Dashboard', exact: true }).click()
    await dashboard(page)
    await page.reload()
    await home(page)
    await expect(page.getByRole('button', { name: 'Reprendre la session' })).toBeVisible()
    expect(session).toEqual(original)
    expect(writes).toEqual([])
  })
}

test('no session: GET and later SSE stay home; resume uses the latest state', async ({ page }) => {
  await page.goto('/')
  await home(page)
  await expect(page.getByRole('button', { name: 'Dashboard', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Reprendre la session' })).toHaveCount(0)
  await expect(page.getByText('Keeper connected', { exact: true })).toBeAttached()
  sendState(mockSessionActive)
  await expect(page.getByRole('button', { name: 'Reprendre la session' })).toBeVisible()
  await home(page)
  // A different session arriving over SSE must not navigate either.
  sendState(mockSessions.defaulted)
  await home(page)
  await page.getByRole('button', { name: 'Reprendre la session' }).click()
  await vault(page, mockSessions.defaulted.vaultId)
  expect(writes).toEqual([])
})

test('landing scroll chapters remain accessible and returning home starts at the top', async ({ page }, testInfo) => {
  session = structuredClone(mockSessionActive)
  await page.goto('/')
  await home(page)
  await expect(page.getByRole('heading', { name: 'Here is what a margin call looks like on Stellar.' })).toHaveCount(1)
  await expect(page.getByRole('heading', { name: 'How it works', exact: true })).toHaveCount(1)
  await page.getByRole('button', { name: 'Skip to start', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000)
  await expect(page.getByRole('button', { name: 'Start a new session', exact: true })).toBeInViewport()
  await page.screenshot({ path: testInfo.outputPath('collateral.png'), animations: 'disabled' })
  await page.getByRole('button', { name: 'Dashboard', exact: true }).click()
  await dashboard(page)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
  await page.getByRole('button', { name: 'Accueil', exact: true }).click()
  await home(page)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
  expect(writes).toEqual([])
})

test('new session requires explicit Start; a failed start stays home', async ({ page }) => {
  session = structuredClone(mockSessionActive)
  await page.goto('/')
  await home(page)
  await page.getByRole('button', { name: 'New session', exact: true }).click()
  expect(writes).toEqual([])
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await home(page)
  rejectStart = true
  await page.getByRole('button', { name: 'Start a new session', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('RpcUnavailable')
  await page.getByRole('button', { name: 'Accueil', exact: true }).click()
  await home(page)
  expect(session).toEqual(mockSessionActive)
  rejectStart = false
  await page.getByRole('button', { name: 'New session', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Start', exact: true }).click()
  await dashboard(page)
  await vault(page, 'MOCK-NEW-VAULT')
  expect(writes).toEqual(['/api/session', '/api/session'])
})

test('first Start creates a session and opens its dashboard', async ({ page }) => {
  await page.goto('/')
  await home(page)
  expect(writes).toEqual([])
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await dashboard(page)
  expect(writes).toEqual(['/api/session'])
})

test('?demo: start, home, resume and reload preserve mode without keeper writes', async ({ page }) => {
  await page.goto('/?demo')
  await home(page)
  await expect(page.getByText('Demo data · nothing sent to Stellar', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await dashboard(page)
  await page.getByRole('button', { name: 'Accueil', exact: true }).click()
  await home(page)
  await page.getByRole('button', { name: 'Reprendre la session' }).click()
  await dashboard(page)
  await expect(page.getByText('Demo data · nothing sent to Stellar', { exact: true })).toBeVisible()
  await page.reload()
  await home(page)
  // The existing mock backend is deliberately in memory: reload starts with no mock session.
  await expect(page.getByRole('button', { name: 'Dashboard', exact: true })).toBeDisabled()
  expect(page.url()).toContain('?demo')
  expect(writes).toEqual([])
})

test('unlocking with an existing session shows home first', async ({ page, context }) => {
  session = structuredClone(mockSessionActive)
  await context.addInitScript(() => sessionStorage.removeItem('keystone.user'))
  await page.goto('/')
  await page.getByRole('textbox', { name: /email/i }).fill('demo@keystone.app')
  await page.getByLabel('Password', { exact: true }).fill('stellar')
  await page.getByRole('button', { name: /sign in/i }).click()
  await home(page)
  await expect(page.getByRole('button', { name: 'Reprendre la session' })).toBeVisible()
  expect(writes).toEqual([])
})
