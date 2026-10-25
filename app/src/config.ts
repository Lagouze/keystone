// Runtime configuration of the dashboard, read from Vite env variables (see .env.example).
export const KEEPER_URL: string =
  import.meta.env.VITE_KEEPER_URL || 'http://localhost:8787/api'

export const USE_MOCKS: boolean = import.meta.env.VITE_USE_MOCKS === 'true'
