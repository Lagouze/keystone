import type { AssetInfo, KeystoneConfig, SessionState } from '@keystone/shared'

export function assetOf(config: KeystoneConfig, session: SessionState): AssetInfo {
  const asset = config.assets.find((a) => a.id === session.asset)
  if (!asset) throw new Error(`Asset ${session.asset} missing from the keeper configuration.`)
  return asset
}
