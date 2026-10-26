import { getNetworkDetails, isConnected, requestAccess, signTransaction } from '@stellar/freighter-api'
import type { FundSigner } from '../api/client.ts'
import { KeystoneError } from '../api/errors.ts'
import { shortAddress } from '../lib/format.ts'

/**
 * Signs a prepared deposit or withdrawal as the fund with Freighter (docs/plan.md section 14):
 * extension present, Testnet, active account = config.accounts.fund, then signature.
 * Written against @stellar/freighter-api 6.0.1.
 */
export const signWithFreighter: FundSigner = async (txXdr, config) => {
  const connection = await isConnected()
  if (connection.error || !connection.isConnected) {
    throw new KeystoneError('FreighterMissing', 'Freighter extension not detected.')
  }

  const network = await getNetworkDetails()
  if (network.error) throw new KeystoneError('FreighterUnavailable', network.error.message)
  if (network.networkPassphrase !== config.networkPassphrase) {
    throw new KeystoneError('FreighterWrongNetwork', `Freighter is on ${network.network || 'another network'}.`)
  }

  const access = await requestAccess()
  if (access.error || !access.address) {
    throw new KeystoneError('FreighterAccessDenied', access.error?.message ?? 'Access not granted.')
  }
  if (access.address !== config.accounts.fund) {
    throw new KeystoneError(
      'FreighterWrongAccount',
      `Active: ${shortAddress(access.address)}, expected: ${shortAddress(config.accounts.fund)}.`,
    )
  }

  const signed = await signTransaction(txXdr, {
    networkPassphrase: config.networkPassphrase,
    address: config.accounts.fund,
  })
  if (signed.error || !signed.signedTxXdr) {
    throw new KeystoneError('FreighterSignatureRefused', signed.error?.message ?? 'Signature declined.')
  }
  if (signed.signerAddress && signed.signerAddress !== config.accounts.fund) {
    throw new KeystoneError('FreighterWrongAccount', `Signed by ${shortAddress(signed.signerAddress)}.`)
  }
  return signed.signedTxXdr
}
