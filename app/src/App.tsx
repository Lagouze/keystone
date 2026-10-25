import { useState } from 'react'
import type { AssetId, KeystoneConfig, SessionState } from '@keystone/shared'
import { KEEPER_URL } from './config.ts'
import { ActionsCard } from './dashboard/ActionsCard.tsx'
import { ActivityFeed } from './dashboard/ActivityFeed.tsx'
import { assetOf } from './dashboard/assets.ts'
import { BalancesCard } from './dashboard/BalancesCard.tsx'
import { KpiStrip } from './dashboard/KpiStrip.tsx'
import { SettlementCard } from './dashboard/SettlementCard.tsx'
import { StatusCard } from './dashboard/StatusCard.tsx'
import { VaultCard } from './dashboard/VaultCard.tsx'
import { formatEur, shortAddress } from './lib/format.ts'
import { useKeystone, useNow } from './state/useKeystone.ts'
import { Banner, Button, Card, SegmentedControl, SimulatedTag } from './ui/index.ts'
import { cx } from './ui/cx.ts'

type KeystoneHook = ReturnType<typeof useKeystone>

export default function App() {
  const k = useKeystone()
  const now = useNow()
  const mocks = k.source === 'mocks'
  const asset = k.config && k.session ? assetOf(k.config, k.session) : null

  return (
    <>
      <TopBar k={k} mocks={mocks} />
      {k.session && asset && <KpiStrip session={k.session} asset={asset} />}

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="grid gap-3 empty:hidden">
          {mocks && (
            <Banner tone="warning">
              Mock data: nothing is sent to Stellar. Hashes and addresses starting with MOCK are fake.
            </Banner>
          )}
          {k.config?.signerMode === 'keeper' && (
            <Banner tone="info">
              Public demo mode: the keeper signs deposits and withdrawals with the demo fund key. The video shows the
              same flow signed by the fund in Freighter.
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
                  {k.error.message} <span className="text-xs opacity-80">({k.error.code})</span>
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
          ) : !k.session || !asset ? (
            <StartSession config={k.config} busy={k.busy === 'start'} onStart={k.startSession} />
          ) : (
            <Dashboard k={k} session={k.session} config={k.config} now={now} mocks={mocks} />
          )}
        </div>
      </main>
    </>
  )
}

function TopBar({ k, mocks }: { k: KeystoneHook; mocks: boolean }) {
  const swap = k.session?.swap
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <span className="text-lg font-medium tracking-tight">Keystone</span>
          <span className="rounded-full border border-line-strong px-2.5 py-1 text-[0.6875rem] font-medium tracking-wider text-ink-muted">
            STELLAR TESTNET
          </span>
          {swap && (
            <span className="text-sm text-ink-muted">
              Fund ↔ Bank · EUR {formatEur(swap.notionalEur).replace(/\.00$/, '')} swap, fund pays fixed · {swap.tenorYears}Y
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-ink-muted">
          <span className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={cx(
                'size-2 rounded-full',
                k.loadError ? 'bg-danger' : k.connection === 'open' ? 'bg-success' : 'bg-warning',
              )}
            />
            {mocks ? 'Mock keeper' : k.loadError ? 'Keeper unreachable' : `Keeper ${k.connection === 'open' ? 'live' : k.connection}`}
          </span>
          {k.config && <span title={k.config.accounts.fund}>Fund {shortAddress(k.config.accounts.fund)}</span>}
          {k.session && k.config && (
            <NewSession
              config={k.config}
              busy={k.busy === 'start'}
              disabled={k.busy !== null && k.busy !== 'start'}
              onStart={k.startSession}
            />
          )}
        </div>
      </div>
    </header>
  )
}

interface DashboardProps {
  k: KeystoneHook
  session: SessionState
  config: KeystoneConfig
  now: number
  mocks: boolean
}

function Dashboard({ k, session, config, now, mocks }: DashboardProps) {
  const asset = assetOf(config, session)
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="grid min-w-0 content-start gap-6">
        <StatusCard
          session={session}
          asset={asset}
          signerMode={config.signerMode}
          busy={k.busy}
          step={k.step}
          now={now}
          onDeposit={k.deposit}
          onSettle={k.settleDefault}
        />
        <VaultCard session={session} asset={asset} />
        <ActionsCard
          session={session}
          asset={asset}
          signerMode={config.signerMode}
          mocks={mocks}
          busy={k.busy}
          step={k.step}
          onDeposit={k.deposit}
          onWithdraw={k.withdraw}
          onShock={k.rateShock}
        />
      </div>
      <aside className="grid min-w-0 content-start gap-6">
        <SettlementCard session={session} asset={asset} />
        <ActivityFeed activity={k.activity} />
        <BalancesCard session={session} asset={asset} />
      </aside>
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
    <div className="mx-auto max-w-2xl py-10">
      <p className="label-caps">Programmable collateral · Stellar Testnet</p>
      <h1 className="mt-3 text-5xl font-light tracking-tight">Post tokens, not cash.</h1>
      <p className="mt-4 text-lg leading-relaxed text-ink-muted">
        A fund and its bank have signed an interest rate swap. Instead of keeping cash aside for margin calls, the fund
        posts tokenized assets it already holds; a Soroban vault locks, releases or settles them by the rules.
      </p>
      <Card className="mt-8" title="Choose the collateral" description="Both assets are fictitious tokens issued by the team on Stellar Testnet.">
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
    </div>
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
