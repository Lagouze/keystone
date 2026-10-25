// Dashboard configuration, read from Vite env variables (see .env.example).
// Values are inlined at build time: changing them requires a rebuild.
export const KEEPER_URL: string = (
  import.meta.env.VITE_KEEPER_URL || 'http://localhost:8787/api'
).replace(/\/+$/, '')

/** Exactly "true" turns the in-browser mock keeper on. */
export const USE_MOCKS: boolean = import.meta.env.VITE_USE_MOCKS === 'true'

/** Mocks only: "keeper" plays the SIGNER=keeper fallback, anything else the Freighter flow. */
export const MOCK_SIGNER_MODE: 'freighter' | 'keeper' =
  import.meta.env.VITE_MOCK_SIGNER === 'keeper' ? 'keeper' : 'freighter'
