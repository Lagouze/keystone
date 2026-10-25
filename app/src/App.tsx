import { useState } from 'react'
import type { AssetId, KeystoneConfig } from '@keystone/shared'
import { KEEPER_URL } from './config.ts'
import { ActionsCard } from './dashboard/ActionsCard.tsx'
import { ActivityFeed } from './dashboard/ActivityFeed.tsx'
import { assetOf } from './dashboard/assets.ts'
import { BalancesCard } from './dashboard/BalancesCard.tsx'
import { MarginCard } from './dashboard/MarginCard.tsx'
import { SwapCard } from './dashboard/SwapCard.tsx'
import { VaultCard } from './dashboard/VaultCard.tsx'
import { formatEur } from './lib/format.ts'
import { useKeystone, useNow } from './state/useKeystone.ts'
import { Banner, Button, Card, SegmentedControl, SimulatedTag } from './ui/index.ts'

export default function App() {
  const k = useKeystone()
  const now = useNow()
  const mocks = k.source === 'mocks'

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-muted">Programmable collateral · Stellar Testnet</p>
          <h1 className="mt-1 text-3xl font-medium tracking-tight">Keystone</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted">
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={`size-2 rounded-full ${
                k.loadError ? 'bg-danger' : k.connection === 'open' ? 'bg-success' : 'bg-warning'
              }`}
            />
            {mocks
              ? 'Mock keeper'
              : k.loadError
                ? 'Keeper unreachable'
                : `Keeper ${k.connection === 'open' ? 'live' : k.connection}`}
          </span>
          {k.session && k.config && (
            <NewSession
              config={k.config}
              busy={k.busy === 'start'}
              disabled={k.busy !== null && k.busy !== 'start'}
              onStart={k.startSession}
            />
          )}
        </div>
      </header>

      <div className="grid gap-4">
        {mocks && (
          <Banner tone="warning">
            Mock data: nothing is sent to Stellar. Hashes and addresses starting with MOCK are fake.
          </Banner>
        )}
        {k.config?.signerMode === 'keeper' && (
          <Banner tone="info">
            Public demo mode: the keeper signs deposits and withdrawals with the demo fund key. The
            video shows the same flow signed by the fund in Freighter.
          </Banner>
        )}
        {k.loadError && (
          <Banner tone="danger" live>
            <div className="flex items-start justify-between gap-4">
              <span>
                Could not load the dashboard ({k.loadError.code}). {k.loadError.message}
                {!mocks && <> Keeper URL: {KEEPER_URL}</>}
              </span>
              <button
                type="button"
                className="shrink-0 text-xs font-medium underline-offset-2 hover:underline"
                onClick={() => window.location.reload()}
              >
                Retry
              </button>
            </div>
          </Banner>
        )}
        {k.error && (
          <Banner tone="danger" live>
            <div className="flex items-start justify-between gap-4">
              <span>
                {k.error.message} <span className="font-mono text-xs">({k.error.code})</span>
              </span>
              <button
                type="button"
                className="shrink-0 text-xs font-medium underline-offset-2 hover:underline"
                onClick={k.dismissError}
              >
                Dismiss
              </button>
            </div>
          </Banner>
        )}
      </div>

      <div className="mt-6">
        {!k.config ? (
          !k.loadError && <p className="text-sm text-ink-muted">Loading…</p>
        ) : !k.session ? (
          <StartSession config={k.config} busy={k.busy === 'start'} onStart={k.startSession} />
        ) : (
          <Dashboard k={k} now={now} mocks={mocks} />
        )}
      </div>
    </main>
  )
}

type KeystoneHook = ReturnType<typeof useKeystone>

function Dashboard({ k, now, mocks }: { k: KeystoneHook; now: number; mocks: boolean }) {
  const config = k.config!
  const session = k.session!
  const asset = assetOf(config, session)
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="grid content-start gap-6">
        <VaultCard session={session} asset={asset} now={now} />
        <ActionsCard
          session={session}
          asset={asset}
          signerMode={config.signerMode}
          mocks={mocks}
          busy={k.busy}
          step={k.step}
          now={now}
          onDeposit={k.deposit}
          onWithdraw={k.withdraw}
          onShock={k.rateShock}
          onSettle={k.settleDefault}
        />
        <div className="grid gap-6 md:grid-cols-2">
          <SwapCard swap={session.swap} margin={session.margin} />
          <MarginCard session={session} asset={asset} />
        </div>
      </div>
      <div className="grid content-start gap-6">
        <BalancesCard session={session} asset={asset} />
        <ActivityFeed activity={k.activity} />
      </div>
    </div>
  )
}

interface StartProps {
  config: KeystoneConfig
  busy: boolean
  disabled?: boolean
  onStart(asset: AssetId): void
}

function StartSession({ config, busy, onStart }: StartProps) {
  const [asset, setAsset] = useState<AssetId>(config.assets[0]?.id ?? 'KMMF')
  const info = config.assets.find((a) => a.id === asset)
  return (
    <Card
      title="Choose the collateral"
      description="The fund posts tokenized assets it already holds instead of keeping cash aside for margin calls. Both assets are fictitious tokens issued by the team on Stellar Testnet."
      className="max-w-2xl"
    >
      <SegmentedControl
        label="Collateral asset"
        value={asset}
        onChange={setAsset}
        options={config.assets.map((a) => ({ value: a.id, label: a.code }))}
      />
      {info && (
        <p className="mt-4 text-sm text-ink-muted">
          {info.label} · unit price {formatEur(info.unitPriceEur)} EUR
          <SimulatedTag /> · haircut {info.haircutPct}%
        </p>
      )}
      <Button className="mt-6" variant="primary" busy={busy} onClick={() => onStart(asset)}>
        {busy ? 'Deploying the vault…' : 'Start session'}
      </Button>
    </Card>
  )
}

function NewSession({ config, busy, disabled, onStart }: StartProps) {
  const [asset, setAsset] = useState<AssetId>(config.assets[0]?.id ?? 'KMMF')
  return (
    <span className="flex items-center gap-2">
      <SegmentedControl
        label="Asset for a new session"
        value={asset}
        onChange={setAsset}
        options={config.assets.map((a) => ({ value: a.id, label: a.code }))}
      />
      <Button
        busy={busy}
        disabled={disabled}
        onClick={() => {
          if (window.confirm('Start a new session? A new vault is deployed and the activity feed is cleared.')) {
            onStart(asset)
          }
        }}
      >
        New session
      </Button>
    </span>
  )
}
