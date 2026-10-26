import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Read the repository's root .env (see .env.example), whatever the working directory.
  // Only VITE_* variables reach the bundle.
  envDir: fileURLToPath(new URL('..', import.meta.url)),
  // PGlite ships its own WebAssembly and data files: Vite must not pre-bundle it.
  optimizeDeps: { exclude: ['@electric-sql/pglite'] },
})
