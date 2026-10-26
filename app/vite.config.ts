import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // "demo" mode (npm run demo / dev:demo): the in-browser mock keeper, no keeper, wallet or network
  // needed. It overrides VITE_USE_MOCKS from .env; only a value set in the shell itself wins.
  if (mode === 'demo') process.env.VITE_USE_MOCKS ??= 'true'
  return {
    plugins: [react(), tailwindcss()],
    // Read the repository's root .env (see .env.example), whatever the working directory.
    // Only VITE_* variables reach the bundle.
    envDir: fileURLToPath(new URL('..', import.meta.url)),
    // PGlite ships its own WebAssembly and data files: Vite must not pre-bundle it.
    optimizeDeps: { exclude: ['@electric-sql/pglite'] },
  }
})
