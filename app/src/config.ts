// Dashboard configuration, read from Vite env variables (see .env.example).
// Values are inlined at build time: changing them requires a rebuild.
export const KEEPER_URL: string =
  import.meta.env.VITE_KEEPER_URL || 'http://localhost:8787/api'

export const USE_MOCKS: boolean = import.meta.env.VITE_USE_MOCKS === 'true'
