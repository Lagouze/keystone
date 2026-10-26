// Dashboard configuration, read from Vite env variables (see .env.example).
// Values are inlined at build time: changing them requires a rebuild.
export const KEEPER_URL: string = (
  import.meta.env.VITE_KEEPER_URL || 'http://localhost:8787/api'
).replace(/\/+$/, '')

/**
 * `?demo` in the page address plays the whole flow on the in-browser mock, on any build: a visitor who has no access
 * code (or no Freighter fund account) can still explore. The page says "Demo data · nothing sent to Stellar".
 */
export const DEMO_REQUESTED: boolean =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo')

/** Exactly "true" turns the in-browser mock keeper on, as does `?demo`. */
export const USE_MOCKS: boolean = import.meta.env.VITE_USE_MOCKS === 'true' || DEMO_REQUESTED

/** Mocks only: "keeper" plays the SIGNER=keeper fallback, anything else the Freighter flow. */
export const MOCK_SIGNER_MODE: 'freighter' | 'keeper' =
  import.meta.env.VITE_MOCK_SIGNER === 'keeper' ? 'keeper' : 'freighter'
