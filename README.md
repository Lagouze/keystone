# Keystone

Keystone is a programmable collateral engine for an OTC interest rate swap between an investment fund and its bank. Instead of keeping cash aside for margin calls, the fund posts tokenized assets it already holds (money market fund shares or sovereign bonds), and a Soroban vault on Stellar locks, releases and, in case of default, transfers that collateral according to deterministic rules.

Built during HackMeridian 2026 (Lisbon, 25–26 October 2026), track Genesis.

> **Project status: phase zero (documentation and interfaces).** No application code has been written yet. Every section below marked *not yet available* or *not tested* will be filled with real, verified values as the build progresses. The progress table (section 12) is the reference.

## 1. Summary

- A swap and its collateral agreement (CSA) are assumed to be already signed. The scenario starts after that.
- The user picks one collateral class: **KMMF** (tokenized money market fund shares) or **KBOND** (tokenized sovereign bond). Both are fictitious assets issued by the team on Stellar Testnet.
- A keeper computes the swap exposure and the required collateral, then posts it to the vault.
- The vault locks what is required, opens a margin call when collateral is missing, releases collateral when exposure falls, and transfers the locked collateral to the bank if a margin call is not met before its deadline.
- Every token movement is a real Stellar Testnet transaction, shown in the dashboard with a link to the explorer.

## 2. Problem, target user and value proposition

**Problem.** In OTC derivatives, exposure moves every day and triggers margin calls. To be ready, a fund often keeps cash available for collateral. That cash is not invested elsewhere: it carries an opportunity cost.

**Target user.** An investment fund that manages margin calls on OTC interest rate swaps, and its bank counterparty.

**Value proposition.** Where the collateral agreement allows it, the fund can post tokenized assets it already holds instead of dedicated cash, and keep the economic exposure attached to those assets. Keystone makes this operational and traceable: eligibility, valuation with haircuts, locking, release and default settlement follow rules that are enforced on-chain, and no party (bank, keeper or developers) can withdraw collateral arbitrarily.

Keystone does not promise a return, does not remove the need for cash entirely, and does not claim that tokenized collateral is new. In this MVP, yields and prices are simulated.

## 3. What the MVP shows, and what is simulated

| Element | Status in the MVP |
| --- | --- |
| Swap, CSA, notional, rates, prices, haircuts | Simulated, labelled as such in the UI |
| Euribor 3M starting value | Last monthly value published by the ECB (cached fallback) |
| KMMF and KBOND | Fictitious classic Stellar assets issued by the team on Testnet |
| Deposits, withdrawals, margin postings, default settlement | **Real Stellar Testnet transactions** executed by the Soroban vault |
| Proof | Transaction hash and stellar.expert link for every on-chain step |

## 4. Live demo

- **Public URL:** *not yet available* (hosting decided at milestone J2, see `docs/decisions.md`, A8).
- The public demo runs in `SIGNER=keeper` mode: judges cannot sign with the demo fund key, so the keeper signs on behalf of the demo fund account. The UI says so. The demo video shows the same flow signed in the Freighter wallet.
- **Demo video:** *not yet available*.

## 5. Architecture and use of Stellar

```
Dashboard (Vite/React + Freighter) --REST--> Keeper (Node/Fastify) --signed tx--> keystone_vault (Soroban, Testnet)
Dashboard <--SSE: state + activity feed-- Keeper                                    | transfers through the SAC
Keeper <-- ECB API (Euribor 3M)                                                     v
Bootstrap script --issues KMMF and KBOND--> fund account                 Fund and bank accounts (trustlines)
```

**Stellar features used**

- **Soroban smart contract** `keystone_vault`: holds the collateral, enforces authorizations, margin rules and default settlement. Immutable once deployed (no admin, no upgrade function).
- **Stellar Asset Contracts (SAC)**: the vault moves KMMF and KBOND through the standard token interface.
- **Classic Stellar assets and trustlines**: KMMF and KBOND are issued by a team account; the fund and the bank hold trustlines.
- **Freighter wallet**: the fund signs its deposits and withdrawals.
- **Soroban RPC and Horizon**: transaction submission, simulation, confirmation and event reading.

**On-chain identifiers** (Stellar Testnet, from [`deployments/testnet.json`](deployments/testnet.json))

| Item | Value |
| --- | --- |
| Issuer of KMMF and KBOND | [`GDWMFOSV4L2O66PDZ4BL4K5HEJJLGMGXXWLHUJNJ4N4ZICSUSBGTGNGX`](https://stellar.expert/explorer/testnet/account/GDWMFOSV4L2O66PDZ4BL4K5HEJJLGMGXXWLHUJNJ4N4ZICSUSBGTGNGX) (no `auth_required` flag) |
| KMMF asset (code:issuer) | `KMMF:GDWMFOSV4L2O66PDZ4BL4K5HEJJLGMGXXWLHUJNJ4N4ZICSUSBGTGNGX` |
| KMMF SAC contract ID | [`CDB3KHRGMFXFRXEVVJUNUCDVPIR5RPKSSCTP5JUBK32F2ZMOZQVLMIA5`](https://stellar.expert/explorer/testnet/contract/CDB3KHRGMFXFRXEVVJUNUCDVPIR5RPKSSCTP5JUBK32F2ZMOZQVLMIA5) |
| KBOND asset (code:issuer) | `KBOND:GDWMFOSV4L2O66PDZ4BL4K5HEJJLGMGXXWLHUJNJ4N4ZICSUSBGTGNGX` |
| KBOND SAC contract ID | [`CDB2XDXZ4CPE242D5KYIKQ2L2PQKENQCSYTW6PA5ROHOX5QWDBKVEUPF`](https://stellar.expert/explorer/testnet/contract/CDB2XDXZ4CPE242D5KYIKQ2L2PQKENQCSYTW6PA5ROHOX5QWDBKVEUPF) |
| `keystone_vault` WASM hash | *not yet deployed* (provided by the contract pole) |
| Example vault contract ID | *not yet deployed* (provided by the contract pole) |
| Demo bank account | [`GAUHK4ZBP2W5VSKLJOTTKKHWUB2MGFXBMHYLSH3EERTVYYMVPWSR7W6C`](https://stellar.expert/explorer/testnet/account/GAUHK4ZBP2W5VSKLJOTTKKHWUB2MGFXBMHYLSH3EERTVYYMVPWSR7W6C) (trustlines on KMMF and KBOND) |
| Keeper account | [`GDGUJHZGU57RU4RHARM37GU2IDX4KV7V23XVFORDWRYIBWIIQ6U7G4TO`](https://stellar.expert/explorer/testnet/account/GDGUJHZGU57RU4RHARM37GU2IDX4KV7V23XVFORDWRYIBWIIQ6U7G4TO) |
| Demo fund account (Freighter) | [`GDQ6AWAXZWIOCBHDSFIIKCWV3PQ6ZJE6BBC4VJCWA3SCFB4G7A2TMQOY`](https://stellar.expert/explorer/testnet/account/GDQ6AWAXZWIOCBHDSFIIKCWV3PQ6ZJE6BBC4VJCWA3SCFB4G7A2TMQOY) (trustlines on KMMF and KBOND, holds 1 000 of each) |

**APIs used:** Soroban RPC (`https://soroban-testnet.stellar.org`), Horizon Testnet, ECB Data Portal API (Euribor 3M, no key).

The exact contract functions, events, errors, keeper API and shared types are specified in [`docs/interfaces.md`](docs/interfaces.md).

## 6. Proof of on-chain transactions

Setup transactions (Testnet bootstrap):

| Step | Transaction |
| --- | --- |
| KMMF Stellar Asset Contract deployed | [`bc7d9d9a…0e11`](https://stellar.expert/explorer/testnet/tx/bc7d9d9a2a15473b5bae6b81461cac9a68003235dea60056605c8b2631df0e11) |
| KBOND Stellar Asset Contract deployed | [`08089cde…dcd3`](https://stellar.expert/explorer/testnet/tx/08089cde2ab558289d0a18c8f85817e18297bb40b41c6506c2d109462b47dcd3) |
| Bank trustline on KMMF | [`463ee916…5b40`](https://stellar.expert/explorer/testnet/tx/463ee916c3136a3ceb6b983fee9392fd8af5c152a765b93a3647c2d663035b40) |
| Bank trustline on KBOND | [`590b9879…e923`](https://stellar.expert/explorer/testnet/tx/590b98798fa2d19d213feabfd3910f1d2b6b09a0902300c1da4250889b86e923) |
| Fund trustline on KMMF | [`a6554f6b…58ca`](https://stellar.expert/explorer/testnet/tx/a6554f6b7772ff683fa9bbf4d578415dc1d9b1264c655e4627c0edf77a6758ca) |
| 1 000 KMMF issued to the fund | [`ec2b3c50…a532`](https://stellar.expert/explorer/testnet/tx/ec2b3c50209bbdfa0851274c03b6cd339b20fdc86774f170cf76d4a65315a532) |
| Fund trustline on KBOND | [`dd531751…5cff`](https://stellar.expert/explorer/testnet/tx/dd531751e447c167f36430666dde853e8345b5b495ba4e1550d14b73ff455cff) |
| 1 000 KBOND issued to the fund | [`637fa5e9…f463`](https://stellar.expert/explorer/testnet/tx/637fa5e953241c7a7a2f474b4239e44871d67e60af667419aff8f16a0f8ff463) |

Collateral flow: *none yet.* Links will be listed here for a deposit, a margin posting that locks collateral, a release and withdrawal, and a default settlement.

## 7. Repository structure and poles

The project is built by three poles working in parallel, each on its own branch, integrated through pull requests into `staging`.

| Pole | Branch | Folders | Owner |
| --- | --- | --- | --- |
| Soroban contract | `contract/collateral` | `contracts/`, `packages/vault-client/` (generated bindings) | Liel |
| Keeper (financial model, API, Testnet scripts) and documentation coordination | `back/keeper` | `keeper/`, `scripts/`, `packages/shared/`, `deployments/` | Grégoire |
| Dashboard | `front/dashboard` | `app/` | Nathan |

```
README.md                  this file
AGENTS.md                  working rules for the AI agents and the team
docs/interfaces.md         shared interfaces (single source of truth)
docs/decisions.md          decisions log
docs/plan.md               full build plan, tasks and milestones
docs/brief.md              project brief
contracts/                 Soroban vault (Rust)
keeper/                    keeper server (TypeScript)
app/                       dashboard (TypeScript, React)
packages/shared/           shared TypeScript types and mocks
packages/vault-client/     TypeScript bindings generated from the contract
scripts/                   Testnet bootstrap and end-to-end scripts
deployments/testnet.json   public on-chain identifiers
```

## 8. Prerequisites, installation and environment variables

**Prerequisites** (versions to be confirmed on each machine during phase zero)

- Node.js ≥ 22 and npm (verified on the keeper machine with Node 24.22.1 and npm 11.19.1)
- Rust ≥ 1.84 with the `wasm32v1-none` target, and stellar-cli ≥ 25.2.0 (contract pole only)
- A browser with the Freighter extension set to Testnet (to sign as the fund)

**Installation.** The repository is an npm workspace (`app`, `keeper`, `packages/*`). From the root:

```bash
npm install
```

Verified on the keeper machine (macOS). Not yet verified on Windows.

**Environment variables** (see `.env.example`; secrets stay in a local `.env`, never committed)

| Variable | Used by | Purpose |
| --- | --- | --- |
| `ISSUER_SECRET` | bootstrap | Issuer of KMMF and KBOND (Testnet only) |
| `FUND_SECRET` | bootstrap, e2e, `SIGNER=keeper` | Demo fund account |
| `BANK_SECRET` | bootstrap | Demo bank account (trustlines) |
| `KEEPER_SECRET` | keeper | Deploys vaults, posts margin, submits settlement |
| `SIGNER` | keeper | `freighter` (default) or `keeper` |
| `PORT` | keeper | API port, default 8787 |
| `VITE_KEEPER_URL` | dashboard | Keeper API base URL |
| `VITE_USE_MOCKS` | dashboard | `true` to run on mocks |

## 9. Commands

Only commands that have been run successfully are listed. Run them from the repository root.

| Command | What it does | Status |
| --- | --- | --- |
| `npm run typecheck` | Type-checks every workspace that defines a `typecheck` script (today: `app`, `packages/shared` and `scripts`) | Verified (macOS) |
| `npm test` | Runs the tests of every workspace that defines a `test` script (today: Vitest checks of the shared mocks and of the script helpers) | Verified (macOS) |
| `npm run init-env` | Creates `.env` from `.env.example` if needed and generates the Testnet keys still empty (issuer, bank, keeper). Never generates `FUND_SECRET`, never overwrites a value, prints public keys only | Verified (macOS) |
| `npm run bootstrap` | Idempotent Testnet bootstrap: issuer, bank and keeper accounts (friendbot), bank trustlines, KMMF and KBOND Stellar Asset Contracts, and, when `FUND_SECRET` is set, fund trustlines and issuance up to 1 000 units of each asset (the fund address is derived from `FUND_SECRET`). Writes `deployments/testnet.json` | Verified (macOS) over seven runs (the first stopped on a bug, since fixed); once everything exists, a run sends no transaction |

Still to come, once they work: start keeper, end-to-end script. Dashboard commands are listed below.

`packages/shared` (`@keystone/shared`) holds the shared types, an exact copy of [`docs/interfaces.md`](docs/interfaces.md) section 5, and mocks under `@keystone/shared/mocks`: a `KeystoneConfig`, one `SessionState` per vault status and the activity feed of scenario 1. Every address and transaction hash in the mocks is fake and starts with `MOCK`. The package ships TypeScript sources with explicit `.ts` import extensions: Vite, `tsx` and Node 24 load them directly, and a consuming TypeScript project needs `allowImportingTsExtensions` (with `noEmit`) or a bundler resolution.

### Dashboard (`app/`)

The dashboard is the `@keystone/app` workspace; it imports the shared types from `@keystone/shared`. Install from the root with `npm install` (see above), then run from the root. Verified on macOS with Node 24.21 and npm 11.19.

| Command | What it does |
| --- | --- |
| `npm run dev -w @keystone/app` | Starts the Vite dev server on `http://localhost:5173`, talking to the keeper at `VITE_KEEPER_URL` |
| `VITE_USE_MOCKS=true npm run dev -w @keystone/app` | Same, on an in-browser mock keeper: both scenarios play without keeper, wallet or network |
| `npm run build -w @keystone/app` | Type-checks, then builds the static site into `app/dist/` |

The root `npm run typecheck` also covers the dashboard.

**Configuration.** The dashboard reads these variables from the root `.env` (or the shell); only `VITE_*` variables reach the browser bundle, and they are fixed at build time.

| Variable | Purpose |
| --- | --- |
| `VITE_KEEPER_URL` | Keeper API base URL, default `http://localhost:8787/api` |
| `VITE_USE_MOCKS` | Exactly `true` to use the in-browser mock keeper (mock data, nothing sent to Stellar, every hash starts with `MOCK`) |
| `VITE_MOCK_SIGNER` | Mocks only: `keeper` plays the `SIGNER=keeper` fallback; otherwise the Freighter flow, with the signature simulated |

**What the dashboard does.** The user picks KMMF or KBOND and starts a session (a new vault). The screen shows the swap (rates labelled as simulated), the margin requirement in EUR and in tokens, the vault (available, locked, shortfall, status and margin-call countdown), the fund and bank balances, and a live activity feed (`GET /events`). Computations are marked *Simulation* and never carry a hash; a *Testnet tx* entry shows its hash and stellar.expert link only once confirmed. Deposits and withdrawals are prepared by the keeper and signed by the fund in Freighter (Testnet, demo fund account checked before signing); when the keeper runs with `SIGNER=keeper` (public demo URL), the dashboard calls the direct routes and says so in a banner.

Verified so far: both scenarios on the mock keeper; the HTTP and SSE client against a stand-in server serving the shared mocks. **Not tested yet:** the real keeper (API not merged yet) and a real Freighter signature.

**Visual direction.** Light surfaces, one navy accent and large tabular numbers ("Ledger clair", chosen by the team). Design tokens live in `app/src/index.css` (Tailwind CSS v4 `@theme`), base components in `app/src/ui/`. Inter and JetBrains Mono are bundled with the app (no external font request).

## 10. Demo instructions

*To be written once the end-to-end flow works.* Two scenarios are planned:

1. **Margin and release (KMMF).** Deposit, rate shock of −50 bp (collateral locked), further −30 bp (margin call, top-up, cured), +60 bp (collateral released and withdrawn).
2. **Default (KBOND).** Deposit, rate shock of −100 bp (margin call), no top-up, 90-second grace period, settlement: the locked collateral is transferred to the bank.

## 11. Workflow

- Each pole works on its branch and opens pull requests into `staging`. No direct commit on `main` or `staging`. Humans merge.
- Every change is reviewed before its pull request by a fresh Claude sub-agent that only sees the diff (Codex on the Windows contract machine), contract pull requests get an extra security review by Claude Code, and every change is tested before merge and updates this README when relevant. See [`AGENTS.md`](AGENTS.md) section 7.
- Rules for agents: [`AGENTS.md`](AGENTS.md). Interfaces: [`docs/interfaces.md`](docs/interfaces.md). Decisions: [`docs/decisions.md`](docs/decisions.md). Plan: [`docs/plan.md`](docs/plan.md).

## 12. Progress

Only the status "verified" counts as done, and only with a proof link.

| # | P0 item | Status | Proof |
| --- | --- | --- | --- |
| 1 | Swap + CSA scenario and margin model | Not started | |
| 2 | KMMF and KBOND issued on Testnet | Verified | [KMMF issued](https://stellar.expert/explorer/testnet/tx/ec2b3c50209bbdfa0851274c03b6cd339b20fdc86774f170cf76d4a65315a532), [KBOND issued](https://stellar.expert/explorer/testnet/tx/637fa5e953241c7a7a2f474b4239e44871d67e60af667419aff8f16a0f8ff463), [KMMF SAC](https://stellar.expert/explorer/testnet/tx/bc7d9d9a2a15473b5bae6b81461cac9a68003235dea60056605c8b2631df0e11), [KBOND SAC](https://stellar.expert/explorer/testnet/tx/08089cde2ab558289d0a18c8f85817e18297bb40b41c6506c2d109462b47dcd3) |
| 3 | Manual choice of collateral class in the UI | Not started | |
| 4 | Soroban vault: authorized deposit, available / locked accounting | Not started | |
| 5 | Keeper: exposure and margin computation, posting to the vault | Not started | |
| 6 | Deposit, lock and release with verifiable results | Not started | |
| 7 | Separate default scenario with on-chain transfer to the bank | Not started | |
| 8 | Real Stellar Testnet transactions shown with proof | Not started | |
| 9 | Dashboard showing asset choice, steps and on-chain proof | In progress (dashboard on mocks; real keeper and Freighter not tested yet) | |
| 10 | End-to-end integration of the three poles | Not started | |
| 11 | Submission: public repo, README, public URL, video, pitch deck | Not started | |
| 12 | Continuous quality: review of every PR, tests, README updates | In place from phase zero | This repository's PR history |

## 13. Prior work and work done during the event

**Before the event:** the idea, a written brief, an empty repository skeleton (folders and a PR policy workflow for `main`), and a test Soroban contract built in a separate project to check the toolchain.

**During the event (25–26 October 2026):** the documentation and interfaces of phase zero, and all application code (contract, keeper, dashboard, scripts). See the commit and pull request history of this repository.

## 14. Known limits

- The swap model uses a flat curve, no coupon cash flows, one-way variation margin (fund to bank), no initial margin.
- The keeper is trusted for the margin requirement value (bounded by a cap set at deployment). It cannot move funds.
- The default is a simplified rule (margin call not met before a short grace period), not a full CSA close-out.
- KMMF and KBOND are fictitious; they carry no real economic rights.
- **Etherfuse Stablebonds were tested and dropped:** on 25 October, an order of sandbox CETES on Etherfuse's API v2 was funded but never delivered to Stellar Testnet. The Etherfuse team confirmed this part of v2 was not finished before the submission deadline, so KBOND represents the bond class instead.
- Testnet only. No real money, no Mainnet.
