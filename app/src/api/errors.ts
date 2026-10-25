// Errors shown by the dashboard: keeper and contract codes (docs/interfaces.md sections 3.6 and 4)
// plus the front's own codes (keeper unreachable, Freighter checks).

export class KeystoneError extends Error {
  readonly code: string
  readonly status: number | undefined

  constructor(code: string, message: string, status?: number) {
    super(message)
    this.name = 'KeystoneError'
    this.code = code
    this.status = status
  }
}

const MESSAGES: Record<string, string> = {
  // Contract (section 3.6)
  InvalidAmount: 'The amount must be greater than zero.',
  InsufficientAvailable: 'The vault does not hold that much available collateral.',
  StaleEpoch: 'A newer margin requirement was already posted.',
  AboveCap: 'The requirement is above the cap set when the vault was deployed.',
  NotInMarginCall: 'There is no open margin call: it was already covered or settled.',
  GracePeriodRunning: 'The deadline is not reached on-chain yet. Try again in a few seconds.',
  NoShortfall: 'Nothing is missing: there is no default to settle.',
  Defaulted: 'The vault has defaulted. Only the available collateral can still be withdrawn.',
  // Keeper (section 4)
  BadRequest: 'The keeper rejected the request.',
  NoSession: 'No session is running. Start one first.',
  SignerModeDisabled: 'This action is not available in the current signing mode.',
  TxFailed: 'The transaction failed.',
  RpcUnavailable: 'Stellar Testnet did not answer in time. The activity feed shows the final outcome.',
  // Front
  KeeperUnreachable: 'The keeper is unreachable. Check that it is running.',
  InvalidInput: 'Check the amount.',
  FreighterMissing: 'Freighter is not installed or not enabled in this browser.',
  FreighterAccessDenied: 'Freighter did not share the account with Keystone.',
  FreighterWrongNetwork: 'Freighter is not on Testnet. Switch its network to Testnet.',
  FreighterWrongAccount: 'The active Freighter account is not the demo fund account.',
  FreighterSignatureRefused: 'The signature was declined in Freighter.',
}

const DETAILED = new Set(['BadRequest', 'TxFailed', 'InvalidInput', 'FreighterWrongAccount', 'FreighterWrongNetwork'])

/** Human-readable text for any error, keeping the code visible for debugging. */
export function describeError(error: unknown): { code: string; message: string } {
  if (error instanceof KeystoneError) {
    const known = MESSAGES[error.code]
    if (!known) return { code: error.code, message: error.message }
    // These codes carry useful details from the keeper or the wallet in `message`.
    const withDetail = DETAILED.has(error.code) && error.message && error.message !== known
    return { code: error.code, message: withDetail ? `${known} ${error.message}` : known }
  }
  return { code: 'Unexpected', message: error instanceof Error ? error.message : String(error) }
}
