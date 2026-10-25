# Keystone — Shared interfaces

**Version: v1.0** (frozen at the end of the kickoff; any later change follows section 6).

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

Public IDs (accounts, assets, SAC contract IDs, WASM hash, test vault) live in `deployments/testnet.json`. The keeper pole writes this file: the bootstrap script fills accounts, assets and SAC IDs; the contract pole provides the WASM hash and the test vault ID with their proofs (PR or Issue), and the keeper pole records them. Secrets never appear in the repository.

## 2. Assets

Both assets are **fictitious**, issued by the team on Testnet, denominated in EUR, with 7 decimals (classic Stellar assets), and exposed to Soroban through their Stellar Asset Contract (SAC). The issuer must **not** set `auth_required`.

| `AssetId` | Code | Class | Simulated unit price | Haircut |
| --- | --- | --- | --- | --- |
| `KMMF` | `KMMF` | Tokenized money market fund shares | 1 000 EUR (simulated NAV) | 2 % |
| `KBOND` | `KBOND` | Tokenized sovereign bond | 1 000 EUR (simulated) | 2 % |

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
    pub epoch: u64,              // number of the last posted requirement, 0 at deployment
    pub call_deadline: u64,      // ledger timestamp, 0 outside a margin call
    pub grace_period_secs: u64,
    pub max_required: i128,
}
```

### 3.2 Functions

| Function | Authorization | Effect |
| --- | --- | --- |
| `__constructor(fund: Address, bank: Address, keeper: Address, asset: Address, max_required: i128, grace_period_secs: u64)` | deployer | Arguments in this exact order. Sets every parameter, with `epoch = 0`. No admin function and no WASM update function exist: the deployed contract is immutable. |
| `deposit(amount: i128) -> VaultState` | `fund.require_auth()` | Transfers `amount` from the fund to the vault, then rebalances. |
| `withdraw(amount: i128) -> VaultState` | `fund.require_auth()` | `amount <= available`. Transfers to the fund, then rebalances (except after `Defaulted`, see 3.3). |
| `post_margin(epoch: u64, required: i128) -> VaultState` | `keeper.require_auth()` | `epoch > last epoch`, `0 <= required <= max_required`. Stores the requirement, then rebalances. The keeper posts epochs 1, 2, 3… |
| `settle_default() -> VaultState` | none (anyone can submit) | Only if `status == MarginCall`, `now >= call_deadline` and `shortfall > 0`. Transfers the previous `locked` to the bank, then sets `locked = required = shortfall = call_deadline = 0`, keeps `available` and `epoch`, and sets `status = Defaulted`. |
| `get_state() -> VaultState` | none | Read only. |

### 3.3 Rebalancing (after `deposit`, `withdraw`, `post_margin`)

1. `total = available + locked`
2. `locked = min(required, total)`, `available = total - locked`, `shortfall = required - locked`
3. If `shortfall > 0` and `status == Active`: `status = MarginCall`, `call_deadline = now + grace_period_secs`
4. If `shortfall == 0` and `status == MarginCall`: `status = Active`, `call_deadline = 0`

A lower `required` therefore releases collateral, which becomes withdrawable.

While `shortfall` stays positive in `MarginCall`, no partial deposit and no new requirement moves `call_deadline`. A cure clears the deadline; a new margin call opens a new one. Reaching the deadline makes settlement possible but does not set `Defaulted` by itself: the fund can still cure until `settle_default` succeeds, and confirmed transactions decide the order of effects.

After `Defaulted`, `withdraw` only subtracts the amount from `available`, without rebalancing and without changing the status; `deposit` and `post_margin` return `Defaulted`. With the rebalancing above, `shortfall > 0` implies `available = 0`, so in the normal flow nothing is left to withdraw after a default.

### 3.4 Invariants (tested)

- The vault's SAC balance is greater than or equal to `available + locked`. Equality is tested for flows that only use the vault's functions, without any external movement of the balance. A surplus received outside `deposit` is not credited to the fund, does not cover the margin, and is neither withdrawn nor transferred by `settle_default`; the MVP has no recovery function.
- Only `withdraw` (to the fund) and `settle_default` (to the bank) move tokens out.
- No role can withdraw arbitrarily: the bank receives tokens only through `settle_default`, the keeper never receives tokens.

### 3.5 Events

Each event has a single topic: a symbol carrying the exact event name below. Data is a map with named keys.

| Event | Data |
| --- | --- |
| `deposited` | `{ amount: i128 }` |
| `withdrawn` | `{ amount: i128 }` |
| `margin_set` | `{ epoch: u64, required: i128, locked: i128, shortfall: i128 }` |
| `margin_call` | `{ call_deadline: u64 }` |
| `cured` | `{}` |
| `defaulted` | `{ amount: i128 }` (amount transferred to the bank) |

### 3.6 Errors (`#[contracterror]`)

`InvalidAmount = 1`, `InsufficientAvailable = 2`, `StaleEpoch = 3`, `AboveCap = 4`, `NotInMarginCall = 5`, `GracePeriodRunning = 6`, `NoShortfall = 7`, `Defaulted = 8`.

- `amount <= 0` and `required < 0` return `InvalidAmount`; `required > max_required` returns `AboveCap`.
- `NoShortfall` is a defensive guard: with the rebalancing of 3.3, a state with `shortfall == 0` is no longer in `MarginCall`. Tests must not assume otherwise.
- Failures outside the vault's business rules (authorization, SAC, RPC) are not one of these eight codes and are never presented as such.

### 3.7 Known limits

- The keeper is trusted for the value of the requirement. It cannot move any token, but an inflated requirement (below `max_required`) can trigger a margin call. In production this value would come from a signed source or be agreed by both parties.
- Tokens sent directly to the vault's address, outside `deposit`, are not credited and stay in the vault (see 3.4).

## 4. Keeper API

Base URL: `http://localhost:8787/api` in local development; the public URL is set at deployment (decision A8). CORS is open to the local and public front. JSON everywhere.

**Formats.** Values travel as strings, never as JSON numbers, except `bp`, `epoch` and `tenorYears`:

- `*Units`: integer in the token's smallest unit (7 decimals: 300 shares = `"3000000000"`). The keeper converts the contract's `i128` straight to a decimal string, without going through a JS `number`.
- `*Eur`: decimal with 2 digits (`"1234.56"`). `mtmFundEur` is negative when the fund loses.
- `*Pct`: percent, `"2.00"` = 2 %. Rates (`fixedRatePct`, `floatRatePct`) have 3 decimals (`"2.034"`), `haircutPct` has 2.
- Timestamps: ISO 8601 UTC. `callDeadline` is derived from the ledger timestamp (seconds) and is `null` outside `margin_call`. The ledger time is authoritative: a browser countdown is only indicative, and `settle-default` can still return `GracePeriodRunning` right after it reaches zero.
- `epoch`: the keeper starts at 1, increments by 1, and checks `epoch <= Number.MAX_SAFE_INTEGER` before converting from `u64`.
- Status mapping: `Active → "active"`, `MarginCall → "margin_call"`, `Defaulted → "defaulted"`.

**Session.** There is at most one active session. `POST /session` replaces the current one (new vault) and clears the activity history.

| Route | Body | Response | On-chain effect |
| --- | --- | --- | --- |
| `GET /health` | — | `{ ok: boolean, network: "testnet" }` | none |
| `GET /config` | — | `KeystoneConfig` (always 200, with or without a session) | none |
| `POST /session` | `{ asset: AssetId }` | `SessionState` | deploys a new vault (signed by the keeper) |
| `GET /session` | — | `SessionState` | reads `get_state` |
| `POST /session/deposit/prepare` | `{ units: string }` | `{ txXdr: string }` | none (simulated, unsigned, fund as source). **Only when `SIGNER=freighter`** |
| `POST /session/withdraw/prepare` | `{ units: string }` | `{ txXdr: string }` | none. **Only when `SIGNER=freighter`** |
| `POST /session/submit` | `{ signedTxXdr: string }` | `SessionState` | submits a transaction signed in Freighter. **Only when `SIGNER=freighter`** |
| `POST /session/rate-shock` | `{ bp: number }` | `SessionState` | `post_margin` if the requirement changes by at least the MTA (signed by the keeper) |
| `POST /session/settle-default` | — | `SessionState` | `settle_default` (submitted by the keeper) |
| `POST /session/deposit` | `{ units: string }` | `SessionState` | **only when `SIGNER=keeper`**: the keeper signs with the demo fund key |
| `POST /session/withdraw` | `{ units: string }` | `SessionState` | **only when `SIGNER=keeper`** |
| `GET /events` | — | Server-Sent Events stream of the current session: `activity` and `state` events (see SSE below), full history replayed on connection | none |

**Write routes** (`POST /session`, `submit`, `rate-shock`, `settle-default`, `deposit`, `withdraw`) respond once the transaction is confirmed or failed (`getTransaction` SUCCESS or FAILED). The `pending` entry is sent on the SSE stream before that. Without confirmation after 60 s, the route returns `RpcUnavailable` and the entry stays `pending` until its outcome is known.

**Rate shock.** `bp` is added to the current float rate (cumulative: −50 then −30 = −80 bp from the start); `floatRateSource` becomes `"scenario"` after the first shock. If the requirement moves by less than the MTA, no transaction is sent and only a `rate_shock` `sim` entry is added. After `defaulted`, `rate-shock` returns `Defaulted` (409) without changing anything: `margin` stays frozen, so `margin.requiredUnits` and `margin.requiredValueEur` remain the last computed requirement, shown as "last computed requirement (historical)" while `vault.requiredUnits` is `"0"`.

**SSE.** Two named events:

- `event: activity`, `data: <ActivityEvent JSON>`. An update re-emits the whole object with the same `id`; clients keep the latest version per `id` and ignore entries whose `sessionId` is not the current session.
- `event: state`, `data: <SessionState JSON>`: the full current state, sent once right after the history replay on every connection, then after every change.

**Errors.** HTTP 4xx or 5xx with body `{ "error": { "code": string, "message": string } }`.

| `code` | HTTP | When |
| --- | --- | --- |
| `BadRequest` | 400 | invalid body (for example `units` not a positive integer) |
| `NoSession` | 404 | `GET /session` or any `/session/*` route without an active session |
| `SignerModeDisabled` | 409 | direct `deposit` / `withdraw` when `SIGNER=freighter`, or `prepare` / `submit` when `SIGNER=keeper` |
| contract error name (section 3.6) | 409 | the vault rejected the call, for example `GracePeriodRunning` |
| `TxFailed` | 502 | transaction rejected or failed outside the vault's business rules (authorization, SAC, simulation); details in `message` |
| `RpcUnavailable` | 503 | RPC unreachable, or no confirmation after 60 s |

`SIGNER=keeper` is used by the end-to-end script and by the **public demo URL**, because judges cannot sign with the fund key. The front shows a visible notice in that mode.

## 5. Shared TypeScript types

The file `packages/shared/src/types.ts` is the exact copy of this block.

```ts
export type AssetId = "KMMF" | "KBOND"; // both fictitious, issued by the team on Testnet
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
  haircutPct: string;    // percent, "2.00" = 2 %
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
    fixedRatePct: string;   // percent, 3 decimals
    floatRatePct: string;   // percent, 3 decimals
    floatRateSource: "ecb" | "cache" | "scenario";
    tenorYears: number;
    direction: "fund_pays_fixed";
  };
  margin: {
    mtmFundEur: string;     // negative when the fund loses
    thresholdEur: string;
    mtaEur: string;
    requiredValueEur: string;
    unitPriceEur: string;
    haircutPct: string;
    requiredUnits: string;  // last computed Q, may differ from vault.requiredUnits under the MTA
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
  balances: { fundUnits: string; bankUnits: string }; // in the session's asset
}

export type ActivityType =
  | "session_started" | "deposit" | "withdraw" | "rate_shock" | "margin_set"
  | "margin_call" | "cured" | "released" | "defaulted" | "error";

export interface ActivityEvent {
  id: string;
  sessionId: string;             // session that produced the entry
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
- a `pending` entry is updated in place, keeping the same `id`;
- entries produced by the same transaction share the same `txHash`.

Mapping to `ActivityType`:

| `ActivityType` | `kind` | Source |
| --- | --- | --- |
| `session_started` | `chain` | vault deployment |
| `deposit` / `withdraw` | `chain` | contract events `deposited` / `withdrawn` |
| `rate_shock` | `sim` | keeper computation (the only entry when the change is below the MTA) |
| `margin_set` | `chain` | contract event `margin_set` |
| `margin_call` / `cured` | `chain` | contract events `margin_call` / `cured` |
| `released` | `chain` | not a contract event: derived from a confirmed decrease of `locked` during rebalancing, added next to `margin_set`; never used for the default settlement |
| `defaulted` | `chain` | contract event `defaulted` |
| `error` | `sim` or `chain` | failed computation or transaction |

## 6. Change rules

- **Compatible change** (new optional field, new event, new route): minor version bump (v1.1, v1.2…), done in the PR that needs it, with the consuming pole mentioned in the PR.
- **Breaking change** (renamed or removed field, changed signature, changed semantics): open an Issue labelled `interface-change`, get an explicit OK from the consuming pole and from a human, then bump the major version and update this file, `packages/shared/src/types.ts` and the mocks in the same PR.
- Nobody builds on a changed interface before the PR that changes it is merged into `staging`.

## 7. Changelog

| Version | Date | Change |
| --- | --- | --- |
| v1.0-rc | 2026-10-25 | Initial proposal for the kickoff. |
| v1.0 | 2026-10-25 | Kickoff amendments (Issue #5): `AssetId` `BOND` → `KBOND`; full constructor signature; state after `settle_default` and no rebalancing after `Defaulted`; deadline rules; SAC balance invariant `>=`; named event data; error precisions; keeper formats, error codes, write-route timing, rate-shock rule (refused after `defaulted`, `margin` frozen), single session; SSE `activity` and `state` events; `ActivityEvent.sessionId`; `ActivityType` mapping; `deployments/testnet.json` written by the keeper. |
