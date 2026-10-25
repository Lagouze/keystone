import { KEEPER_URL, MOCK_SIGNER_MODE, USE_MOCKS } from '../config.ts'
import { signWithFreighter } from '../wallet/freighter.ts'
import type { FundSigner, KeeperClient } from './client.ts'
import { createHttpClient } from './http.ts'

export interface Backend {
  client: KeeperClient
  /** Signs deposits and withdrawals when config.signerMode is "freighter". */
  signer: FundSigner
}

/** Real keeper and Freighter, or the in-browser mock (imported only when mocks are on). */
export async function createBackend(): Promise<Backend> {
  if (USE_MOCKS) {
    const { createMockClient, mockSigner } = await import('./mock.ts')
    return { client: createMockClient(MOCK_SIGNER_MODE), signer: mockSigner }
  }
  return { client: createHttpClient(KEEPER_URL), signer: signWithFreighter }
}
