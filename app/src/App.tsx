import { useEffect, useState } from 'react'
import type { ActivityEvent, AssetId, VaultStatus } from '@keystone/shared'
import { KEEPER_URL, USE_MOCKS } from './config.ts'
import {
  AllocationBar,
  Banner,
  Button,
  Card,
  KindBadge,
  SegmentedControl,
  SimulatedTag,
  Stat,
  StatusPill,
  ActivityProof,
} from './ui/index.ts'

// Direction A preview: shows the base components on static sample values.
// F2 replaces this screen with the real dashboard wired to the keeper API (or the shared mocks).

// Whole units for readability; the bar takes smallest units like the keeper sends them.
// Values follow the shared mocks (scenario 1 for active / margin_call, scenario 2 for defaulted).
const SAMPLE: Record<
  VaultStatus,
  { available: number; locked: number; shortfall: number; requiredEur: string; required: number }
> = {
  active: { available: 54, locked: 246, shortfall: 0, requiredEur: '240,210.11', required: 246 },
  margin_call: { available: 0, locked: 300, shortfall: 96, requiredEur: '387,331.01', required: 396 },
  defaulted: { available: 0, locked: 0, shortfall: 0, requiredEur: '486,682.24', required: 497 },
}

const toUnits = (whole: number) => (BigInt(whole) * 10n ** 7n).toString()

const MOCK_HASH = 'MOCK3f9a0000000000000000000000000000000000000000000000000000c21e'

const SAMPLE_ACTIVITY: ActivityEvent[] = [
  {
    id: 'preview-1',
    sessionId: 'preview',
    ts: '2026-10-25T21:00:00Z',
    kind: 'chain',
    type: 'margin_set',
    title: 'Margin set',
    status: 'confirmed',
    txHash: MOCK_HASH,
    explorerUrl: `https://stellar.expert/explorer/testnet/tx/${MOCK_HASH}`,
  },
  {
    id: 'preview-2',
    sessionId: 'preview',
    ts: '2026-10-25T21:00:05Z',
    kind: 'chain',
    type: 'deposit',
    title: 'Deposit 96 KMMF',
    status: 'pending',
  },
  {
    id: 'preview-3',
    sessionId: 'preview',
    ts: '2026-10-25T20:59:55Z',
    kind: 'sim',
    type: 'rate_shock',
    title: 'Rate shock −30 bp',
    status: 'confirmed',
  },
]

export default function App() {
  const [asset, setAsset] = useState<AssetId>('KMMF')
  const [status, setStatus] = useState<VaultStatus>('margin_call')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!busy) return
    const timer = window.setTimeout(() => setBusy(false), 1500)
    return () => window.clearTimeout(timer)
  }, [busy])
  const vault = SAMPLE[status]

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-muted">Stellar Testnet · design preview</p>
          <h1 className="mt-1 text-3xl font-medium tracking-tight">Keystone</h1>
        </div>
        <SegmentedControl
          label="Collateral asset"
          value={asset}
          onChange={setAsset}
          options={[
            { value: 'KMMF', label: 'KMMF' },
            { value: 'KBOND', label: 'KBOND' },
          ]}
        />
      </header>

      <div className="grid gap-6">
        <Banner tone="info">
          Public demo mode: the keeper signs on behalf of the demo fund account (SIGNER=keeper).
        </Banner>

        <Card
          title={`Collateral vault · ${asset}`}
          description="Tokens the fund has posted. The vault locks what the margin requires and releases the rest."
          actions={
            <StatusPill status={status}>{status === 'margin_call' ? '01:12' : undefined}</StatusPill>
          }
        >
          <dl className="mb-6 grid grid-cols-3 gap-4 sm:gap-6">
            <Stat label="Available" value={String(vault.available)} unit={asset} />
            <Stat label="Locked" value={String(vault.locked)} unit={asset} tone="accent" />
            <Stat
              label="Shortfall"
              value={String(vault.shortfall)}
              unit={asset}
              tone={vault.shortfall > 0 ? 'warning' : 'default'}
            />
          </dl>
          <AllocationBar
            available={toUnits(vault.available)}
            locked={toUnits(vault.locked)}
            shortfall={toUnits(vault.shortfall)}
            label={`Locked ${vault.locked}, available ${vault.available}, shortfall ${vault.shortfall} ${asset}`}
          />
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card title="Margin" description="What the swap exposure requires, converted into tokens.">
            <dl className="grid grid-cols-2 gap-6">
              <Stat label="Required value" value={vault.requiredEur} unit="EUR" size="md" />
              <Stat
                label="Required"
                value={String(vault.required)}
                unit={asset}
                size="md"
                hint={status === 'defaulted' ? 'Last computed (historical)' : 'MTA 50,000 EUR'}
              />
            </dl>
            <p className="mt-4 text-sm text-ink-muted">
              Unit price 1,000 EUR
              <SimulatedTag /> · haircut 2%
            </p>
          </Card>

          <Card title="Activity" description="Every token movement links to its Stellar transaction.">
            <ul className="divide-y divide-line">
              {SAMPLE_ACTIVITY.map((event) => (
                <li key={event.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="flex items-center gap-2 text-sm">
                    <KindBadge kind={event.kind} /> {event.title}
                  </span>
                  <ActivityProof event={event} />
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card title="Components" description="Buttons, statuses and banners used across the dashboard.">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              busy={busy}
              onClick={() => setBusy(true)}
            >
              {busy ? 'Signing…' : 'Deposit'}
            </Button>
            <Button>Withdraw</Button>
            <Button variant="ghost">Rate shock −50 bp</Button>
            <Button variant="danger">Settle default</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <SegmentedControl
              label="Vault status preview"
              value={status}
              onChange={setStatus}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'margin_call', label: 'Margin call' },
                { value: 'defaulted', label: 'Defaulted' },
              ]}
            />
          </div>
          <div className="mt-5 grid gap-3">
            <Banner tone="warning">Freighter is on the wrong network. Switch it to Testnet.</Banner>
            <Banner tone="danger">The transaction failed (GracePeriodRunning). Try again in a few seconds.</Banner>
          </div>
        </Card>

        <p className="text-xs text-ink-subtle">
          Data source: {USE_MOCKS ? 'mocks (VITE_USE_MOCKS=true)' : KEEPER_URL} · sample values, hashes
          prefixed MOCK
        </p>
      </div>
    </main>
  )
}
