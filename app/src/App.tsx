import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import type { AssetId, KeystoneConfig, VaultStatus } from '@keystone/shared'
import { LockScreen } from './auth/LockScreen.tsx'
import { currentUser, rememberUser } from './auth/session.ts'
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
import { useKeystone } from './state/useKeystone.ts'
import SwipeToast from './ui/bits/SwipeToast.tsx'
import { Banner, Button, HeroSkeleton, Logo, SegmentedControl, Wordmark } from './ui/index.ts'
import { Modal } from './ui/Modal.tsx'
import { cx } from './ui/cx.ts'

type KeystoneHook = ReturnType<typeof useKeystone>

/**
 * Page-level transition: content fades and rises in, Apple style. No filter here: a filter left on
 * the page would become the containing block of everything `fixed` inside it.
 */
const PAGE = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const },
}

/** The lock screen comes first; the keeper connection opens only once someone is signed in. */
export default function App() {
  const [user, setUser] = useState<string | null>(currentUser)
  const unlock = (email: string) => {
    rememberUser(email)
    setUser(email)
  }
  const lock = () => {
    rememberUser(null)
    setUser(null)
  }
  return (
    <>
      <Aura />
      <AnimatePresence>
      {user ? (
        <motion.div key="app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.15 }}>
          <Main user={user} onLock={lock} />
        </motion.div>
      ) : (
        <LockScreen key="lock" onUnlock={unlock} />
      )}
      </AnimatePresence>
    </>
  )
}

/** The page's background: three slow soft auras behind every screen (see .aura in index.css). */
function Aura() {
  // While the page scrolls, the drift pauses: the glass panels then frost a still background.
  useEffect(() => {
    const root = document.documentElement
    let timer = 0
    const onScroll = () => {
      if (!timer) root.dataset.scrolling = ''
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        delete root.dataset.scrolling
        timer = 0
      }, 180)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.clearTimeout(timer)
      delete root.dataset.scrolling
    }
  }, [])
  return (
    <div className="aura" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  )
}

function Main({ user, onLock }: { user: string; onLock(): void }) {
  const k = useKeystone()
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
      <TopBar
        k={k}
        mocks={mocks}
        user={user}
        onLock={onLock}
        onDetails={stage && asset ? () => setDetails(true) : undefined}
        onStart={startSession}
      />

      <div className="mx-auto grid max-w-6xl gap-3 px-4 pt-4 empty:hidden sm:px-6">
        {k.loadError && (
          <Banner tone="danger" live>
            <div className="flex items-start justify-between gap-4">
              <span>
                {k.loadError.code === 'KeeperUnreachable' ? 'Keeper unreachable.' : `Keeper error (${k.loadError.code}).`}{' '}
                {k.loadError.message}
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
                  <span>
                    {k.error.message} <span className="text-xs opacity-70">({k.error.code})</span>
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait" onExitComplete={() => window.scrollTo(0, 0)}>
        {!k.config ? (
          !k.loadError && (
            <motion.div key="loading" {...PAGE}>
              <HeroSkeleton />
            </motion.div>
          )
        ) : !stage || !asset ? (
          <motion.main key="landing" {...PAGE}>
            <Landing config={k.config} busy={k.busy === 'start'} onStart={startSession} />
          </motion.main>
        ) : (
          <motion.main key={`session-${stage.shown.sessionId}`} {...PAGE} className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
            <Dashboard k={k} stage={stage} config={k.config} mocks={mocks} />
            <DetailsModal open={details} onClose={() => setDetails(false)} session={stage.shown} asset={asset} />
          </motion.main>
        )}
      </AnimatePresence>
    </>
  )
}

/** A fact about the connection, as quiet type (no pill). */
function Chip({ children }: { children: ReactNode }) {
  return <span className="text-xs font-medium tracking-wide text-ink-subtle">{children}</span>
}

function TopBar({
  k,
  mocks,
  user,
  onLock,
  onDetails,
  onStart,
}: {
  k: KeystoneHook
  mocks: boolean
  user: string
  onLock(): void
  onDetails?: () => void
  onStart(asset: AssetId): void
}) {
  return (
    <header className="sticky top-3 z-40 px-3 sm:px-6">
      <div className="glass mx-auto flex min-h-14 max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-[2rem] px-5 py-2 shadow-card sm:rounded-full sm:px-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Logo height={22} />
          <h1 className="text-[0.9375rem]">
            <Wordmark />
          </h1>
          {mocks ? <Chip>Demo data · nothing sent to Stellar</Chip> : <Chip>Testnet</Chip>}
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
            <span className={cx(!mocks && !k.loadError && k.connection !== 'open' ? 'text-xs' : 'sr-only')}>
              {k.loadError ? 'Keeper unreachable' : mocks ? 'Mock keeper' : k.connection === 'open' ? 'Live' : 'Reconnecting…'}
            </span>
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
          <button
            type="button"
            onClick={onLock}
            title={`Signed in as ${user}`}
            aria-label={`Lock (signed in as ${user})`}
            className="glass flex size-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-chain"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <rect x="2.5" y="6" width="9" height="6.5" rx="1.6" fill="currentColor" />
              <path d="M4.5 6V4.5a2.5 2.5 0 0 1 5 0V6" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  )
}

interface DashboardProps {
  k: KeystoneHook
  stage: Stage
  config: KeystoneConfig
  mocks: boolean
}

const TOAST: Record<VaultStatus, { title: string; description: string }> = {
  active: { title: 'Covered', description: 'The vault holds what the margin needs.' },
  margin_call: { title: 'Margin call', description: 'Collateral is missing. The clock is running.' },
  defaulted: { title: 'Default settled', description: 'The locked tokens went to the bank.' },
}

/** Panels rise in once, 60 ms apart, when a session opens. */
function Reveal({ index, opening, children, className }: { index: number; opening: boolean; children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={cx('min-w-0', className)}
      initial={opening ? { opacity: 0, y: 12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: opening ? (index * CHOREO.openingStaggerMs) / 1000 : 0, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}

function Dashboard({ k, stage, config, mocks }: DashboardProps) {
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
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid min-w-0 content-start gap-4">
        <Reveal index={0} opening={stage.opening}>
          <div ref={statusRef}>
            <StatusCard
              stage={stage}
              asset={asset}
              signerMode={config.signerMode}
              busy={k.busy}
              step={k.step}
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
      {/* The right column never sets the row's height: it fills what the left column needs, and the
          activity list scrolls inside it, so both columns end on the same line. */}
      <aside className="relative min-w-0 lg:min-h-[34rem]">
        <div className="flex min-h-0 flex-col gap-4 lg:absolute lg:inset-0">
          <Reveal index={3} opening={stage.opening} className="shrink-0">
            <MarketCard session={session} asset={asset} opening={stage.opening} />
          </Reveal>
          <Reveal index={4} opening={stage.opening} className="flex min-h-0 flex-1 flex-col">
            <ActivityFeed activity={k.activity} />
          </Reveal>
        </div>
      </aside>
      {toast &&
        createPortal(
        <SwipeToast
          key={toast}
          title={TOAST[toast].title}
          description={TOAST[toast].description}
          background="rgba(255, 255, 255, 0.8)"
          color="#1c1c1e"
          fuseColor={toast === 'active' ? '#1d7f3a' : '#c9372c'}
          duration={5000}
          onClose={() => setToast(null)}
        />,
          document.body,
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
          disabled={busy || disabled}
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
