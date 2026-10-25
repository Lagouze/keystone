// vite/client is loaded through tsconfig.app.json "types".

interface ImportMetaEnv {
  readonly VITE_KEEPER_URL?: string
  readonly VITE_USE_MOCKS?: string
}
