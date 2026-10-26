import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { AssetId, KeystoneConfig, VaultStatus } from '@keystone/shared'
import { KEEPER_URL } from './config.ts'
import { ActionsCard } from './dashboard/ActionsCard.tsx'
import { ActivityFeed } from './dashboard/ActivityFeed.tsx'
import { assetOf } from './dashboard/assets.ts'
import { DetailsModal } from './dashboard/DetailsModal.tsx'
import { Landing } from './dashboard/Landing.tsx'
import { MarketCard } from './dashboard/MarketCard.tsx'
import { StatusCard } from './dashboard/StatusCard.tsx'
import { VaultCard } from './dashboard/VaultCard.tsx'
import { CHOREO, useChoreography, type Stage } from './state/useChoreography.ts'
import { useKeystone, useNow } from './state/useKeystone.ts'
import SwipeToast from './ui/bits/SwipeToast.tsx'
import { Banner, Button, SegmentedControl } from './ui/index.ts'
import { Modal } from './ui/Modal.tsx'
import { cx } from './ui/cx.ts'

type KeystoneHook = ReturnType<typeof useKeystone>

/** Page-level transition: content fades and sharpens in, Apple style. */
const PAGE = {
  initial: { opacity: 0, y: 12, filter: 'blur(6px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -8, filter: 'blur(6px)' },
  transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const },
}

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
  const [details, setDetails] = useState(false)

  return (
    <>
      <TopBar k={k} mocks={mocks} onDetails={stage && asset ? () => setDetails(true) : undefined} onStart={startSession} />

      <div className="mx-auto grid max-w-6xl gap-3 px-4 pt-4 empty:hidden sm:px-6">
        {k.loadError && (
          <Banner tone="danger" live>
            <div className="flex items-start justify-between gap-4">
              <span>
                Keeper unreachable. {k.loadError.message}
                {!mocks && <> ({KEEPER_URL})</>}
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
        <AnimatePresence>
          {k.error && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
              <Banner tone="danger" live>
                <div className="flex items-start justify-between gap-4">
                  <span>{k.error.message}</span>
                  <button
                    type="button"
                    className="shrink-0 text-xs font-medium underline-offset-2 hover:underline"
                    onClick={k.dismissError}
                  >
                    Dismiss
                  </button>
                </div>
              </Banner>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait">
        {!k.config ? (
          !k.loadError && (
            <motion.p key="loading" {...PAGE} className="mt-24 text-center text-sm text-ink-subtle">
              Loading…
            </motion.p>
          )
        ) : !stage || !asset ? (
          <motion.main key="landing" {...PAGE}>
            <Landing config={k.config} busy={k.busy === 'start'} onStart={startSession} />
          </motion.main>
        ) : (
          <motion.main key={`session-${stage.shown.sessionId}`} {...PAGE} className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
            <Dashboard k={k} stage={stage} config={k.config} now={now} mocks={mocks} />
            <DetailsModal open={details} onClose={() => setDetails(false)} session={stage.shown} asset={asset} />
          </motion.main>
        )}
      </AnimatePresence>
    </>
  )
}

function Chip({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-surface-muted px-2.5 py-1 text-[0.6875rem] font-medium text-ink-muted">{children}</span>
}

function TopBar({
  k,
  mocks,
  onDetails,
  onStart,
}: {
  k: KeystoneHook
  mocks: boolean
  onDetails?: () => void
  onStart(asset: AssetId): void
}) {
  return (
    <header className="glass sticky top-0 z-40 border-x-0 border-t-0 !bg-white/60">
      <div className="mx-auto flex min-h-14 max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2 sm:px-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="mr-2 text-[1.0625rem] font-medium tracking-tight">Keystone</h1>
          <Chip>Testnet</Chip>
          {mocks && <Chip>Demo data</Chip>}
          {/* §4: the public demo (SIGNER=keeper) must say that the keeper signs for the fund. */}
          {k.config?.signerMode === 'keeper' && <Chip>Public demo · keeper signs</Chip>}
        </div>
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          <span className="mr-2 flex items-center gap-2" title={mocks ? 'Mock keeper' : `Keeper ${k.connection}`}>
            <span
              aria-hidden="true"
              className={cx(
                'size-2 rounded-full',
                k.loadError ? 'bg-danger' : k.connection === 'open' ? 'bg-success' : 'bg-ink-subtle',
              )}
            />
            <span className="sr-only">{k.loadError ? 'Keeper unreachable' : `Keeper ${k.connection}`}</span>
          </span>
          {onDetails && (
            <Button variant="sim" className="!h-9 !px-4" onClick={onDetails}>
              Details
            </Button>
          )}
          {k.session && k.config && (
            <NewSession
              config={k.config}
              busy={k.busy === 'start'}
              disabled={k.busy !== null && k.busy !== 'start'}
              onStart={onStart}
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
  active: { title: 'Covered', description: 'The vault holds what the margin needs.' },
  margin_call: { title: 'Margin call', description: 'Collateral is missing. The clock is running.' },
  defaulted: { title: 'Default settled', description: 'The locked tokens went to the bank.' },
}

/** Panels rise in once, 60 ms apart, when a session opens. */
function Reveal({ index, opening, children }: { index: number; opening: boolean; children: ReactNode }) {
  return (
    <motion.div
      className="min-w-0"
      initial={opening ? { opacity: 0, y: 12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: opening ? (index * CHOREO.openingStaggerMs) / 1000 : 0, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}

function Dashboard({ k, stage, config, now, mocks }: DashboardProps) {
  const session = stage.shown
  const asset = assetOf(config, session)

  // A status change is announced by a toast only when the status panel is off screen (no duplicate).
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
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="grid min-w-0 content-start gap-5">
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
      <aside className="grid min-w-0 content-start gap-5">
        <Reveal index={3} opening={stage.opening}>
          <MarketCard session={session} asset={asset} opening={stage.opening} />
        </Reveal>
        <Reveal index={4} opening={stage.opening}>
          <ActivityFeed activity={k.activity} />
        </Reveal>
      </aside>
      {toast && (
        <SwipeToast
          key={toast}
          title={TOAST[toast].title}
          description={TOAST[toast].description}
          background="rgba(255, 255, 255, 0.85)"
          color="#1d1d1f"
          fuseColor={toast === 'active' ? '#1d7f3a' : '#c9372c'}
          duration={5000}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}

interface NewSessionProps {
  config: KeystoneConfig
  busy: boolean
  disabled?: boolean
  onStart(asset: AssetId): void
}

/** "New session" opens a small sheet to pick the asset: no selector cluttering the header. */
function NewSession({ config, busy, disabled, onStart }: NewSessionProps) {
  const [open, setOpen] = useState(false)
  const [asset, setAsset] = useState<AssetId>(config.assets[0]?.id ?? 'KMMF')
  return (
    <>
      <Button className="!h-9 !px-4" busy={busy} disabled={disabled} onClick={() => setOpen(true)}>
        New session
      </Button>
      <Modal open={open} title="New session" onClose={() => setOpen(false)}>
        <p className="mb-4 text-sm text-ink-muted">A new vault is deployed and the activity is cleared.</p>
        <SegmentedControl
          label="Collateral asset"
          value={asset}
          onChange={setAsset}
          options={config.assets.map((a) => ({ value: a.id, label: a.code }))}
        />
        <Button
          className="mt-6 w-full"
          variant="primary"
          onClick={() => {
            setOpen(false)
            onStart(asset)
          }}
        >
          Start
        </Button>
      </Modal>
    </>
  )
}
