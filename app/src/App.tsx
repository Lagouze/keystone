import { useEffect, useRef, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import type { AssetId, KeystoneConfig, VaultStatus } from '@keystone/shared'
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
import { CHOREO, useChoreography, type Stage } from './state/useChoreography.ts'
import { useKeystone, useNow } from './state/useKeystone.ts'
import RippleGrid from './ui/bits/RippleGrid.tsx'
import SwipeToast from './ui/bits/SwipeToast.tsx'
import { Banner, Button, Card, SegmentedControl, SimulatedTag } from './ui/index.ts'
import { cx } from './ui/cx.ts'

type KeystoneHook = ReturnType<typeof useKeystone>

export default function App() {
  const k = useKeystone()
  const now = useNow()
  // Set when the user starts a session from this page: that first session opens with the stagger.
  const [startedHere, setStartedHere] = useState(false)
  const stage = useChoreography(k.session, startedHere)
  const startSession = (asset: AssetId) => {
    setStartedHere(true)
    return k.startSession(asset)
  }
  const mocks = k.source === 'mocks'
  const asset = k.config && k.session ? assetOf(k.config, k.session) : null

  return (
    <>
      <TopBar k={k} mocks={mocks} />
      {stage && asset && (
        <KpiStrip session={stage.shown} asset={asset} opening={stage.opening} duration={stage.figuresDuration} />
      )}

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
          ) : !stage || !asset ? (
            <StartSession config={k.config} busy={k.busy === 'start'} onStart={startSession} />
          ) : (
            // Keyed by session: a new session remounts the cards (stagger) and resets the toast state.
            <Dashboard key={stage.shown.sessionId} k={k} stage={stage} config={k.config} now={now} mocks={mocks} />
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
          <h1 className="text-lg font-medium tracking-tight">Keystone</h1>
          <span className="rounded-full border border-line-strong px-2.5 py-1 text-[0.6875rem] font-medium tracking-wider text-ink-muted">
            STELLAR TESTNET
          </span>
          {swap && (
            <span className="text-sm text-ink-muted">
              Fund ↔ Bank · EUR {formatEur(swap.notionalEur).replace(/\.00$/, '')} swap · fund pays {swap.fixedRatePct}% fixed, receives Euribor 3M · {swap.tenorYears}Y
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
  stage: Stage
  config: KeystoneConfig
  now: number
  mocks: boolean
}

const TOAST: Record<VaultStatus, { title: string; description: string }> = {
  active: { title: 'Covered', description: 'The vault holds what the margin requires.' },
  margin_call: { title: 'Margin call', description: 'Collateral is missing. The grace period has started.' },
  defaulted: { title: 'Default settled', description: 'The locked collateral was transferred to the bank.' },
}

/** Cards fade in once, 60 ms apart, when a session opens (the only stagger of the product). */
function Reveal({ index, opening, children }: { index: number; opening: boolean; children: ReactNode }) {
  return (
    <motion.div
      className="min-w-0"
      initial={opening ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: opening ? (index * CHOREO.openingStaggerMs) / 1000 : 0, ease: [0.4, 0, 0.2, 1] }}
    >
      {children}
    </motion.div>
  )
}

function Dashboard({ k, stage, config, now, mocks }: DashboardProps) {
  const session = stage.shown
  const asset = assetOf(config, session)

  // A status change is announced by a toast only when the status card is off screen (no duplicate).
  const statusRef = useRef<HTMLDivElement>(null)
  // null until the first observation: nothing is announced while visibility is unknown.
  const [statusVisible, setStatusVisible] = useState<boolean | null>(null)
  useEffect(() => {
    const node = statusRef.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setStatusVisible(entry?.isIntersecting ?? null), {
      threshold: 0.2,
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  const lastStatus = useRef(stage.status)
  const [toast, setToast] = useState<VaultStatus | null>(null)
  useEffect(() => {
    if (stage.status === lastStatus.current) return
    lastStatus.current = stage.status
    if (statusVisible === false) setToast(stage.status)
  }, [stage.status, statusVisible])

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="grid min-w-0 content-start gap-6">
        <Reveal index={0} opening={stage.opening}>
          <div ref={statusRef}>
            <StatusCard
              stage={stage}
              asset={asset}
              signerMode={config.signerMode}
              busy={k.busy}
              step={k.step}
              now={now}
              onDeposit={k.deposit}
              onSettle={k.settleDefault}
            />
          </div>
        </Reveal>
        <Reveal index={1} opening={stage.opening}>
          <VaultCard session={session} asset={asset} duration={stage.figuresDuration} />
        </Reveal>
        <Reveal index={2} opening={stage.opening}>
          <ActionsCard
            session={session}
            asset={asset}
            signerMode={config.signerMode}
            mocks={mocks}
            busy={k.busy}
            step={k.step}
            sequencing={stage.sequencing}
            onDeposit={k.deposit}
            onWithdraw={k.withdraw}
            onShock={k.rateShock}
          />
        </Reveal>
      </div>
      <aside className="grid min-w-0 content-start gap-6">
        <Reveal index={3} opening={stage.opening}>
          <SettlementCard session={session} asset={asset} transfer={stage.transfer} transferUnits={stage.transferUnits} />
        </Reveal>
        <Reveal index={4} opening={stage.opening}>
          <ActivityFeed activity={k.activity} />
        </Reveal>
        <Reveal index={5} opening={stage.opening}>
          <BalancesCard session={session} asset={asset} duration={stage.figuresDuration} />
        </Reveal>
      </aside>
      {toast && (
        <SwipeToast
          key={toast}
          title={TOAST[toast].title}
          description={TOAST[toast].description}
          background="#ffffff"
          color="#0b1f33"
          fuseColor={toast === 'margin_call' ? '#b86e00' : toast === 'defaulted' ? '#b42318' : '#0f7b3f'}
          duration={5000}
          onClose={() => setToast(null)}
        />
      )}
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
    <div className="relative">
      {/* Morpho-style blueprint grid with a slow ripple: only on this screen. */}
      <div className="pointer-events-none absolute inset-x-0 -top-6 h-[28rem] [mask-image:linear-gradient(to_bottom,black,transparent)]" aria-hidden="true">
        <RippleGrid lightMode color="#0b1f33" opacity={0.18} cellSize={48} glow={0} rippleStrength={0.6} rippleSpeed={0.5} rippleInterval={4} mouseInteraction={false} clickRipple={false} />
      </div>
      <div className="relative mx-auto max-w-2xl py-10">
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
