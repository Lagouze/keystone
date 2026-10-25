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

**On-chain identifiers** (filled from `deployments/testnet.json` once deployed)

| Item | Value |
| --- | --- |
| KMMF asset (code:issuer) | *not yet deployed* |
| KMMF SAC contract ID | *not yet deployed* |
| KBOND asset (code:issuer) | *not yet deployed* |
| KBOND SAC contract ID | *not yet deployed* |
| `keystone_vault` WASM hash | *not yet deployed* |
| Example vault contract ID | *not yet deployed* |
| Demo accounts (fund, bank, keeper) | *not yet created* |

**APIs used:** Soroban RPC (`https://soroban-testnet.stellar.org`), Horizon Testnet, ECB Data Portal API (Euribor 3M, no key).

The exact contract functions, events, errors, keeper API and shared types are specified in [`docs/interfaces.md`](docs/interfaces.md).

## 6. Proof of on-chain transactions

*None yet.* Links to stellar.expert (Testnet) will be listed here for: a deposit, a margin posting that locks collateral, a release and withdrawal, and a default settlement.

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

- Node.js 22 LTS and npm
- Rust ≥ 1.84 with the `wasm32v1-none` target, and stellar-cli ≥ 25.2.0 (contract pole only)
- A browser with the Freighter extension set to Testnet (to sign as the fund)

**Installation:** *not tested yet.* The commands will be added here once they have been run successfully.

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

*Not tested yet.* Each command will be listed with what it does once it has been run successfully (build, test, bootstrap Testnet, start keeper, start dashboard, end-to-end script).

### Dashboard (`app/`)

Run from `app/`. Tested with Node 24.21 and npm 11.19. The dashboard is a standalone npm package until the root npm workspaces are set up.

| Command | What it does |
| --- | --- |
| `npm ci` | Installs the dashboard dependencies from `app/package-lock.json` |
| `npm run dev` | Starts the Vite dev server on `http://localhost:5173` |
| `npm run typecheck` | Type-checks the dashboard and the shared types it imports from `packages/shared` |
| `npm run build` | Type-checks, then builds the static site into `app/dist/` |

The dashboard reads `VITE_KEEPER_URL` (default `http://localhost:8787/api`) and `VITE_USE_MOCKS`. At this stage it only shows a placeholder screen: no keeper call, no wallet.

## 10. Demo instructions

*To be written once the end-to-end flow works.* Two scenarios are planned:

1. **Margin and release (KMMF).** Deposit, rate shock of −50 bp (collateral locked), further −30 bp (margin call, top-up, cured), +60 bp (collateral released and withdrawn).
2. **Default (KBOND).** Deposit, rate shock of −100 bp (margin call), no top-up, 90-second grace period, settlement: the locked collateral is transferred to the bank.

## 11. Workflow

- Each pole works on its branch and opens pull requests into `staging`. No direct commit on `main` or `staging`. Humans merge.
- Every code change is reviewed with Claudex (Claude Code ↔ Codex) and tested before merge, and updates this README when relevant.
- Rules for agents: [`AGENTS.md`](AGENTS.md). Interfaces: [`docs/interfaces.md`](docs/interfaces.md). Decisions: [`docs/decisions.md`](docs/decisions.md). Plan: [`docs/plan.md`](docs/plan.md).

## 12. Progress

Only the status "verified" counts as done, and only with a proof link.

| # | P0 item | Status | Proof |
| --- | --- | --- | --- |
| 1 | Swap + CSA scenario and margin model | Not started | |
| 2 | KMMF and KBOND issued on Testnet | Not started | |
| 3 | Manual choice of collateral class in the UI | Not started | |
| 4 | Soroban vault: authorized deposit, available / locked accounting | Not started | |
| 5 | Keeper: exposure and margin computation, posting to the vault | Not started | |
| 6 | Deposit, lock and release with verifiable results | Not started | |
| 7 | Separate default scenario with on-chain transfer to the bank | Not started | |
| 8 | Real Stellar Testnet transactions shown with proof | Not started | |
| 9 | Dashboard showing asset choice, steps and on-chain proof | In progress (app scaffold) | |
| 10 | End-to-end integration of the three poles | Not started | |
| 11 | Submission: public repo, README, public URL, video, pitch deck | Not started | |
| 12 | Continuous quality: Claudex review, tests, README updates | In place from phase zero | This repository's PR history |

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
