import { motion } from 'motion/react'
import type { SignerMode } from '@keystone/shared'
import { KEEPER_URL, USE_MOCKS } from './config.ts'

// F1 scaffold: placeholder screen, deliberately unstyled until the team picks a visual direction.
const SIGNER_MODES: readonly SignerMode[] = ['freighter', 'keeper']

export default function App() {
  return (
    <motion.main
      className="p-8 font-sans"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <h1 className="text-2xl font-semibold">Keystone</h1>
      <p className="mt-2">Dashboard scaffold (Stellar Testnet).</p>
      <dl className="mt-4 text-sm">
        <dt className="font-medium">Data source</dt>
        <dd>{USE_MOCKS ? 'mocks (VITE_USE_MOCKS=true)' : KEEPER_URL}</dd>
        <dt className="mt-2 font-medium">Signer modes</dt>
        <dd>{SIGNER_MODES.join(' / ')}</dd>
      </dl>
    </motion.main>
  )
}
