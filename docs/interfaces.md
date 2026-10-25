# Keystone — Shared interfaces

**Version: v1.0-rc** (release candidate, to be amended during the kickoff and frozen as v1.0 before the GO).

This file is the single source of truth for everything exchanged between the three poles: the Soroban contract, the keeper API and the shared TypeScript types. `README.md` and `AGENTS.md` refer to it. When they disagree, this file wins.

Change rules are at the end of the file (section 6).

## 1. Network

| Item | Value |
| --- | --- |
| Network | Stellar Testnet only |
| Passphrase | `Test SDF Network ; September 2015` |
| Soroban RPC | `https://soroban-testnet.stellar.org` |
| Horizon | `https://horizon-testnet.stellar.org` |
| Friendbot | `https://friendbot.stellar.org?addr=<G...>` |
| Explorer (tx) | `https://stellar.expert/explorer/testnet/tx/<hash>` |

Public IDs (accounts, assets, SAC contract IDs, WASM hash) live in `deployments/testnet.json`, written by the bootstrap script (keeper pole) and by the contract pole for `wasmHash`. Secrets never appear in the repository.

## 2. Assets

Both assets are **fictitious**, issued by the team on Testnet, denominated in EUR, with 7 decimals (classic Stellar assets), and exposed to Soroban through their Stellar Asset Contract (SAC). The issuer must **not** set `auth_required`.

| `AssetId` | Code | Class | Simulated unit price | Haircut |
| --- | --- | --- | --- | --- |
| `KMMF` | `KMMF` | Tokenized money market fund shares | 1 000 EUR (simulated NAV) | 2 % |
| `BOND` | `KBOND` | Tokenized sovereign bond | 1 000 EUR (simulated) | 2 % |

The vault does not know prices: it only handles token quantities. Prices and haircuts are used by the keeper.

## 3. Soroban contract `keystone_vault`

One vault instance is deployed per demo session by the keeper, from the WASM uploaded by the contract pole. All amounts are `i128` in the token's smallest unit.

### 3.1 Types

```rust
#[contracttype]
pub enum Status { Active, MarginCall, Defaulted }

#[contracttype]
pub struct VaultState {
    pub fund: Address,
    pub bank: Address,
    pub keeper: Address,
    pub asset: Address,          // SAC contract ID of KMMF or KBOND
    pub available: i128,         // deposited, not locked, withdrawable by the fund
    pub locked: i128,            // locked under the CSA
    pub required: i128,          // last requirement posted by the keeper
    pub shortfall: i128,         // required - locked, never negative
    pub status: Status,
    pub epoch: u64,              // number of the last posted requirement
    pub call_deadline: u64,      // ledger timestamp, 0 outside a margin call
    pub grace_period_secs: u64,
    pub max_required: i128,
}
```

### 3.2 Functions

| Function | Authorization | Effect |
| --- | --- | --- |
| `__constructor(fund, bank, keeper, asset, max_required: i128, grace_period_secs: u64)` | deployer | Sets every parameter. No admin function and no WASM update function exist: the deployed contract is immutable. |
| `deposit(amount: i128) -> VaultState` | `fund.require_auth()` | Transfers `amount` from the fund to the vault, then rebalances. |
| `withdraw(amount: i128) -> VaultState` | `fund.require_auth()` | `amount <= available`. Transfers to the fund, then rebalances. Allowed after `Defaulted` for the available part. |
| `post_margin(epoch: u64, required: i128) -> VaultState` | `keeper.require_auth()` | `epoch > last epoch`, `0 <= required <= max_required`. Stores the requirement, then rebalances. |
| `settle_default() -> VaultState` | none (anyone can submit) | Only if `status == MarginCall`, `now >= call_deadline` and `shortfall > 0`. Transfers exactly `locked` to the bank, sets `Defaulted`. |
| `get_state() -> VaultState` | none | Read only. |

### 3.3 Rebalancing (after `deposit`, `withdraw`, `post_margin`)

1. `total = available + locked`
2. `locked = min(required, total)`, `available = total - locked`, `shortfall = required - locked`
3. If `shortfall > 0` and `status == Active`: `status = MarginCall`, `call_deadline = now + grace_period_secs`
4. If `shortfall == 0` and `status == MarginCall`: `status = Active`, `call_deadline = 0`

A lower `required` therefore releases collateral, which becomes withdrawable. After `Defaulted`, `deposit` and `post_margin` are rejected.

### 3.4 Invariants (tested)

- The vault's SAC balance always equals `available + locked`.
- Only `withdraw` (to the fund) and `settle_default` (to the bank) move tokens out.
- No role can withdraw arbitrarily: the bank receives tokens only through `settle_default`, the keeper never receives tokens.

### 3.5 Events

The first topic is the event name.

| Event | Data |
| --- | --- |
| `deposited` | amount |
| `withdrawn` | amount |
| `margin_set` | epoch, required, locked, shortfall |
| `margin_call` | call_deadline |
| `cured` | — |
| `defaulted` | amount transferred to the bank |

### 3.6 Errors (`#[contracterror]`)

`InvalidAmount = 1`, `InsufficientAvailable = 2`, `StaleEpoch = 3`, `AboveCap = 4`, `NotInMarginCall = 5`, `GracePeriodRunning = 6`, `NoShortfall = 7`, `Defaulted = 8`.

### 3.7 Known trust limit

The keeper is trusted for the value of the requirement. It cannot move any token, but an inflated requirement (below `max_required`) can trigger a margin call. In production this value would come from a signed source or be agreed by both parties.

## 4. Keeper API

Base URL: `http://localhost:8787/api` in local development; the public URL is set at deployment (decision A8). JSON everywhere. Amounts travel as strings: integers in the token's smallest unit for `units`, decimals with 2 digits for EUR values.

| Route | Body | Response | On-chain effect |
| --- | --- | --- | --- |
| `GET /health` | — | `{ ok: boolean, network: "testnet" }` | none |
| `GET /config` | — | `KeystoneConfig` | none |
| `POST /session` | `{ asset: AssetId }` | `SessionState` | deploys a new vault (signed by the keeper) |
| `GET /session` | — | `SessionState` | reads `get_state` |
| `POST /session/deposit/prepare` | `{ units: string }` | `{ txXdr: string }` | none (simulated, unsigned, fund as source) |
| `POST /session/withdraw/prepare` | `{ units: string }` | `{ txXdr: string }` | none |
| `POST /session/submit` | `{ signedTxXdr: string }` | `SessionState` | submits a transaction signed in Freighter |
| `POST /session/rate-shock` | `{ bp: number }` | `SessionState` | `post_margin` if the requirement changes by at least the MTA (signed by the keeper) |
| `POST /session/settle-default` | — | `SessionState` | `settle_default` (submitted by the keeper) |
| `POST /session/deposit` | `{ units: string }` | `SessionState` | **only when `SIGNER=keeper`**: the keeper signs with the demo fund key |
| `POST /session/withdraw` | `{ units: string }` | `SessionState` | **only when `SIGNER=keeper`** |
| `GET /events` | — | Server-Sent Events stream of `ActivityEvent`, full history replayed on connection | none |

Errors: HTTP 4xx or 5xx with body `{ "error": { "code": string, "message": string } }`. When the error comes from the contract, `code` is the contract error name (for example `GracePeriodRunning`).

`SIGNER=keeper` is used by the end-to-end script and by the **public demo URL**, because judges cannot sign with the fund key. The front shows a visible notice in that mode.

## 5. Shared TypeScript types

The file `packages/shared/src/types.ts` is the exact copy of this block.

```ts
export type AssetId = "KMMF" | "BOND"; // BOND = KBOND, fictitious tokenized sovereign bond
export type VaultStatus = "active" | "margin_call" | "defaulted";
export type SignerMode = "freighter" | "keeper";

export interface AssetInfo {
  id: AssetId;
  code: string;          // "KMMF" | "KBOND"
  issuer: string;        // G... address of the team issuer
  sac: string;           // C... SAC contract ID
  decimals: number;      // 7
  label: string;         // human-readable name shown in the UI
  unitPriceEur: string;  // simulated
  haircutPct: string;
}

export interface KeystoneConfig {
  network: "testnet";
  networkPassphrase: string;
  explorerTxBase: string; // "https://stellar.expert/explorer/testnet/tx/"
  accounts: { fund: string; bank: string; keeper: string };
  assets: AssetInfo[];
  signerMode: SignerMode;
}

export interface SessionState {
  sessionId: string;
  asset: AssetId;
  vaultId: string;        // C... contract ID of this session's vault
  updatedAt: string;      // ISO 8601
  swap: {
    notionalEur: string;
    fixedRatePct: string;
    floatRatePct: string;
    floatRateSource: "ecb" | "cache" | "scenario";
    tenorYears: number;
    direction: "fund_pays_fixed";
  };
  margin: {
    mtmFundEur: string;
    thresholdEur: string;
    mtaEur: string;
    requiredValueEur: string;
    unitPriceEur: string;
    haircutPct: string;
    requiredUnits: string;
  };
  vault: {
    availableUnits: string;
    lockedUnits: string;
    requiredUnits: string;
    shortfallUnits: string;
    status: VaultStatus;
    epoch: number;
    callDeadline: string | null; // ISO 8601, null outside a margin call
  };
  balances: { fundUnits: string; bankUnits: string };
}

export type ActivityType =
  | "session_started" | "deposit" | "withdraw" | "rate_shock" | "margin_set"
  | "margin_call" | "cured" | "released" | "defaulted" | "error";

export interface ActivityEvent {
  id: string;
  ts: string;                    // ISO 8601
  kind: "sim" | "chain";         // local computation or real Testnet transaction
  type: ActivityType;
  title: string;
  detail?: string;
  status: "pending" | "confirmed" | "failed";
  txHash?: string;               // required when kind = "chain" and status = "confirmed"
  explorerUrl?: string;          // required when kind = "chain" and status = "confirmed"
}

export interface ApiError {
  error: { code: string; message: string };
}
```

Display rules:

- a `chain` entry becomes `confirmed` only after `getTransaction` returns SUCCESS;
- a `sim` entry never carries a hash;
- a `pending` entry is updated in place, keeping the same `id`.

## 6. Change rules

- **Compatible change** (new optional field, new event, new route): minor version bump (v1.1, v1.2…), done in the PR that needs it, with the consuming pole mentioned in the PR.
- **Breaking change** (renamed or removed field, changed signature, changed semantics): open an Issue labelled `interface-change`, get an explicit OK from the consuming pole and from a human, then bump the major version and update this file, `packages/shared/src/types.ts` and the mocks in the same PR.
- Nobody builds on a changed interface before the PR that changes it is merged into `staging`.

## 7. Changelog

| Version | Date | Change |
| --- | --- | --- |
| v1.0-rc | 2026-10-25 | Initial proposal for the kickoff. |
