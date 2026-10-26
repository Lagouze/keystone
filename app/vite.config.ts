import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

/**
 * A build made on Vercel must not ship the localhost default: the hosted page would call the visitor's own
 * machine. It must name an HTTPS keeper (an HTTP one would be blocked as mixed content) unless it is an
 * explicit mock build, which labels itself "Demo data" on screen.
 */
function assertHostedBuild(mode: string) {
  if (!process.env.VERCEL || mode === 'demo') return
  const env = { ...loadEnv(mode, fileURLToPath(new URL('..', import.meta.url)), 'VITE_'), ...process.env }
  if (env.VITE_USE_MOCKS === 'true') return
  const url = env.VITE_KEEPER_URL ?? ''
  if (!/^https:\/\/[^/]+/i.test(url) || /^https:\/\/(localhost|127\.|\[::1\])/i.test(url)) {
    throw new Error('VITE_KEEPER_URL must be the HTTPS address of the hosted keeper (for example https://<keeper>/api) for a Vercel build')
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // "demo" mode (npm run demo / dev:demo): the in-browser mock keeper, no keeper, wallet or network
  // needed. It overrides VITE_USE_MOCKS from .env; only a value set in the shell itself wins.
  if (mode === 'demo') process.env.VITE_USE_MOCKS ??= 'true'
  assertHostedBuild(mode)
  return {
    plugins: [react(), tailwindcss()],
    // Read the repository's root .env (see .env.example), whatever the working directory.
    // Only VITE_* variables reach the bundle.
    envDir: fileURLToPath(new URL('..', import.meta.url)),
    // PGlite ships its own WebAssembly and data files: Vite must not pre-bundle it.
    optimizeDeps: { exclude: ['@electric-sql/pglite'] },
  }
})
