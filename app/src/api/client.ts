import type { ActivityEvent, AssetId, KeystoneConfig, SessionState } from '@keystone/shared'

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting'

export interface StreamListener {
  onActivity(event: ActivityEvent): void
  onState(state: SessionState): void
  onConnection(status: ConnectionStatus): void
}

/**
 * The keeper API of docs/interfaces.md section 4. The same interface is served by the real
 * keeper (HTTP + SSE) and by the in-browser mock (VITE_USE_MOCKS=true), so the dashboard code
 * does not change between the two.
 */
export interface KeeperClient {
  readonly source: 'keeper' | 'mocks'
  getConfig(): Promise<KeystoneConfig>
  /** Current session, or null when the keeper answers NoSession. */
  getSession(): Promise<SessionState | null>
  startSession(asset: AssetId): Promise<SessionState>
  prepareDeposit(units: string): Promise<{ txXdr: string }>
  prepareWithdraw(units: string): Promise<{ txXdr: string }>
  submit(signedTxXdr: string): Promise<SessionState>
  /** SIGNER=keeper only. */
  deposit(units: string): Promise<SessionState>
  /** SIGNER=keeper only. */
  withdraw(units: string): Promise<SessionState>
  rateShock(bp: number): Promise<SessionState>
  settleDefault(): Promise<SessionState>
  /** Opens the live stream (history replayed first). Returns a function that closes it. */
  subscribe(listener: StreamListener): () => void
}

/** Signs a prepared transaction XDR as the fund and returns the signed XDR. */
export type FundSigner = (txXdr: string, config: KeystoneConfig) => Promise<string>
