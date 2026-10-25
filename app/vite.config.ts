import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Exact match only, so that future subpaths (e.g. mocks) can get their own alias.
    alias: [
      {
        find: /^@keystone\/shared$/,
        replacement: fileURLToPath(
          new URL('../packages/shared/src/types.ts', import.meta.url),
        ),
      },
    ],
  },
})
