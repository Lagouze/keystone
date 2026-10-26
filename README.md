# Keystone

Keystone is a programmable collateral engine for an OTC interest rate swap between an investment fund and its bank. Instead of keeping cash aside for margin calls, the fund posts tokenized assets it already holds (money market fund shares or sovereign bonds), and a Soroban vault on Stellar locks, releases and, in case of default, transfers that collateral according to deterministic rules.

Built during HackMeridian 2026 (Lisbon, 25–26 October 2026), track Genesis.

> **Project status: backend MVP demonstrated on Testnet.** The shared types, the Testnet bootstrap, the margin model, the Soroban vault (C1 deposit/withdraw/margin and C2 default settlement) and a keeper API that drives it exist. Both scenarios were played on Stellar Testnet through the keeper's session code (section 6). The dashboard has not been run against the real keeper yet, the public URL, the video and the deck are missing. Every section below marked *not yet available* or *not tested* will be filled with real, verified values as the build progresses. The progress table (section 12) is the reference.

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
| `keystone_vault` WASM hash | `6ca6314db610635008d8a1a6e6b55f69306dd25bb9488a78adb18ef274195b6b` (C2 build, [upload](https://stellar.expert/explorer/testnet/tx/1911a4bb1f2b5b6e5199364ecb56cf48577714ff9669a8947898514810cec62f); the 8 528-byte WASM was fetched back from Testnet and its SHA-256 matches). New sessions deploy this build. The C1 build (`173fc4aa…8516`) is kept in `deployments/testnet.json` under `vault.c1` |
| Example vault contract ID | [`CARBSCRLX2DJKMGYB3TPJ7WEAWZZ5HSIOE4CXY4PG6ZGR3Y5HZLON226`](https://stellar.expert/explorer/testnet/contract/CARBSCRLX2DJKMGYB3TPJ7WEAWZZ5HSIOE4CXY4PG6ZGR3Y5HZLON226) (C2, KBOND, team accounts, cap 1 000 tokens, grace 90 s, never used). The C1 vault with the first test deposit is [`CCLE3RBD…CB2N`](https://stellar.expert/explorer/testnet/contract/CCLE3RBDYNMRMBVTAPXLQ5JRWQOGR3RHOQYCMH43N6VYY6T2OGSZCB2N) |
| Demo bank account | [`GAUHK4ZBP2W5VSKLJOTTKKHWUB2MGFXBMHYLSH3EERTVYYMVPWSR7W6C`](https://stellar.expert/explorer/testnet/account/GAUHK4ZBP2W5VSKLJOTTKKHWUB2MGFXBMHYLSH3EERTVYYMVPWSR7W6C) (trustlines on KMMF and KBOND) |
| Keeper account | [`GDGUJHZGU57RU4RHARM37GU2IDX4KV7V23XVFORDWRYIBWIIQ6U7G4TO`](https://stellar.expert/explorer/testnet/account/GDGUJHZGU57RU4RHARM37GU2IDX4KV7V23XVFORDWRYIBWIIQ6U7G4TO) |
| Demo fund account (Freighter) | [`GDQ6AWAXZWIOCBHDSFIIKCWV3PQ6ZJE6BBC4VJCWA3SCFB4G7A2TMQOY`](https://stellar.expert/explorer/testnet/account/GDQ6AWAXZWIOCBHDSFIIKCWV3PQ6ZJE6BBC4VJCWA3SCFB4G7A2TMQOY) (trustlines on KMMF and KBOND, issued 1 000 of each; holds 999 KMMF after the C1 test deposit) |

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

Contract C1 (deployed by the contract pole, recorded in `deployments/testnet.json`):

| Step | Transaction |
| --- | --- |
| `keystone_vault` WASM upload (ledger 5387705) | [`cf981253…431d`](https://stellar.expert/explorer/testnet/tx/cf9812534038af3f17741140dcb5963ceae8ef6b6c3645cfe1a1bff2bc35431d) |
| Vault deployment (ledger 5388742) | [`66af4894…bdec`](https://stellar.expert/explorer/testnet/tx/66af48946f18f1a16673c78eb37a76ace759c1ba0b9ab35ec825df65c9ecbdec) |
| Deposit of 1 KMMF signed by the demo fund account (ledger 5388931) | [`17868920…7202`](https://stellar.expert/explorer/testnet/tx/178689208be148899ac567ac6c68da6526e040b39962d313d9594a4eeca07202) |

All three were read back from the Soroban RPC with status `SUCCESS`. After the deposit, the vault reports `available = 10000000` (1 KMMF), `locked = 0`, status `Active`; the vault's KMMF balance went from 0 to `10000000` and the fund's from `10000000000` to `9990000000` (balances read from the SAC by the throwaway script; the transaction itself carries one SAC `transfer` of `10000000` from the fund to the vault), and the transaction emitted one `deposited` event with `{amount: 10000000}`. The deposit was signed with the fund key from a throwaway script (not Freighter, which is untested).

Scenario 1 on a fresh C1 vault [`CDL5GRMUQGDTCFVRKJPXKUUIXYLICZOPQP54WYODPGN2XLIVHKWGTQA2`](https://stellar.expert/explorer/testnet/contract/CDL5GRMUQGDTCFVRKJPXKUUIXYLICZOPQP54WYODPGN2XLIVHKWGTQA2), run by the keeper (`npm run integration:c1 -w @keystone/keeper`, start rate 2.635 % from the ECB, K = 2.640 %). Each step was checked against `get_state` and the SAC balances:

| Step | Result | Transaction |
| --- | --- | --- |
| Vault deployed by `POST /session` logic | new vault, `Active` | [`5ad8a9c6…5c89`](https://stellar.expert/explorer/testnet/tx/5ad8a9c6c0112dfbfa30082aa4fe4a6bb9bf2abd46d48e873b119e350c565c89) |
| Deposit 300 KMMF (demo fund key) | available 300 | [`eaeeb3da…dec2`](https://stellar.expert/explorer/testnet/tx/eaeeb3da25b832b9e7019099fb74e8396f9d07a3bd6e5b638db152a3757cdec2) |
| Rate shock −50 bp, `post_margin` epoch 1 | locked 243.7615, available 56.2385 | [`d575193f…a5f0`](https://stellar.expert/explorer/testnet/tx/d575193f3c49bed24541a0f03dde70129c0242b570305440e6bdb2ca2c75a5f0) |
| Rate shock −30 bp, epoch 2 | required 391.5791, locked 300, **margin call** (shortfall 91.5791) | [`2ab68614…2bf8`](https://stellar.expert/explorer/testnet/tx/2ab686146bdfb603848c4278b34b776b37fab0ab79d85ebb3664e9ce82fd2bf8) |
| Deposit 100 KMMF | **cured**, locked 391.5791 | [`9b5a3e55…29c5ed`](https://stellar.expert/explorer/testnet/tx/9b5a3e55d371077f2b89e5c0e315f033200e9d56914b749d6153d6336d29c5ed) |
| Rate shock +60 bp, epoch 3 | required 98.1948, **293.3843 released** | [`91527a41…0dbb`](https://stellar.expert/explorer/testnet/tx/91527a412eae01b080f3fe7b5b076904649613688cfe3964630034cd385d0dbb) |
| Withdrawal of the released 301.8052 | fund back to 900.8052 | [`7de52778…7c4a`](https://stellar.expert/explorer/testnet/tx/7de52778115187c6ecaadcef3eb4cef294ad045b9713e9b13e63012034bd7c4a) |
| Rate shock +30 bp, epoch 4 | required 0, 98.1948 released | [`33cf9729…3b3a`](https://stellar.expert/explorer/testnet/tx/33cf9729cf357e09adfa72fcf32bd00798ab450a5929a8ac999ef6c4cfa63b3a) |
| Final withdrawal of 98.1948 | vault empty, fund back to 999 KMMF | [`1b9f9f00…a801`](https://stellar.expert/explorer/testnet/tx/1b9f9f00e58eb1a82572e9e7dd6dbad5270244ba0c93f866bfa562823283a801) |

The `prepare` / `submit` path (wallet signing) was exercised on another vault with the fund key standing in for Freighter (one-off script, not kept in the repository, so not reproducible): deposit [`85d0f132…2eee`](https://stellar.expert/explorer/testnet/tx/85d0f132bb236da6352ca35718ad9302c26aead25b3b73dab2ab95a4eb452eee) and withdrawal [`a6401141…8d91`](https://stellar.expert/explorer/testnet/tx/a640114144b9141cfaa78c76e5daadf30af776245b453cbab433a99f7ebf8d91); an unsigned transaction is refused with `BadRequest`. Freighter itself is not tested.

Scenario 2 (default, KBOND) on a fresh C2 vault [`CALYRUMGT3J3P32NHBDTRDWJD3JU2AEIXEKRCFDNZ7I6GHKU5DBBKFWA`](https://stellar.expert/explorer/testnet/contract/CALYRUMGT3J3P32NHBDTRDWJD3JU2AEIXEKRCFDNZ7I6GHKU5DBBKFWA), with the team accounts (`npm run e2e:scenario2 -w @keystone/keeper`, 2026-10-26). Every transaction was read back from the RPC as `SUCCESS`:

| Step | Result | Transaction |
| --- | --- | --- |
| Vault deployed (KBOND) | `Active` | [`1863c33a…f764`](https://stellar.expert/explorer/testnet/tx/1863c33adb251dcbc76365f7cd7209c5c51b4406d40e6fc86fcd7b56709af764) |
| Deposit 300 KBOND | available 300 | [`f3b7ca05…dad7`](https://stellar.expert/explorer/testnet/tx/f3b7ca0578a9ea86add5c863bfa9d6aefea8bca670e13e0350741a575f55dad7) |
| Rate shock −100 bp, `post_margin` epoch 1 | required 491.3927, locked 300, shortfall 191.3927, **margin call** (90 s) | [`bb429b24…9d3e`](https://stellar.expert/explorer/testnet/tx/bb429b24a9fa71c432a4ee8f5558c5b1ce907ddacad6e4209cfc9896634a9d3e) |
| `settle_default` before the deadline | refused: `GracePeriodRunning` (simulation, **no transaction, no hash**) | n/a |
| `settle_default` after the ledger deadline, submitted by the keeper account (no vault role authorizes it) | `Defaulted`; the 300 KBOND locked went to the bank (bank 0 → 300); event `defaulted {amount: 3000000000}` | [`33793f42…112c`](https://stellar.expert/explorer/testnet/tx/33793f423facfa6e2968da335558cc9bba2cc296b6ea6e2133b734829309112c) |
| Replay, deposit, rate shock, withdraw after the default | refused: `NotInMarginCall`, `Defaulted`, `Defaulted`, `InsufficientAvailable` (no hash) | n/a |

After the default the keeper still shows the last computed requirement (historical) while `vault.requiredUnits` is `0`. The C2 WASM hash above is the one fetched back from Testnet (8 528 bytes). A local rebuild with `stellar contract build` gives a WASM of the same size but another SHA-256 (`4a03f7ff…3ea6`, built 2026-10-26 on the keeper machine): the build is not byte-reproducible across machines (probably toolchain and build metadata embedded in the binary; not investigated further). Nothing was redeployed; the behaviour of the deployed build is what the Testnet runs above exercise, and the contract pole checked the bindings' ABI against it.

Scenario 1 was also replayed on a C2 vault (`CD3MAB27BM57BM5SVGAIM5CTBDJPAVSUHFCKDHNZHBHBMNGI6KX7QAC7`) with all script checks passing; its hashes were not recorded, so that replay is not a proof and the C1-build hashes above remain the reference table. An independent settlement fixture of the contract pole (fictitious KSC1 asset) is in `contracts/keystone_vault/testnet-c2.json`.

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
| `KEEPER_BACKEND` | keeper | `testnet` (real vault on Stellar Testnet, real transactions) or `fake` (in-memory vault, fake `FAKE…` hashes, no transaction; used by the tests). No default: the keeper refuses to start without it |
| `KEEPER_ALLOWED_ORIGINS` | keeper | Extra browser origins allowed by CORS (comma separated). `localhost` and `127.0.0.1` are always allowed; the keeper listens on `127.0.0.1` only |
| `VITE_KEEPER_URL` | dashboard | Keeper API base URL |
| `VITE_USE_MOCKS` | dashboard | `true` to run on mocks |

## 9. Commands

Only commands that have been run successfully are listed. Run them from the repository root.

| Command | What it does | Status |
| --- | --- | --- |
| `npm run typecheck` | Type-checks every workspace that defines a `typecheck` script (today: `app`, `packages/shared`, `scripts` and `keeper`) | Verified (macOS) |
| `npm test` | Runs the tests of every workspace that defines a `test` script (today: Vitest checks of the shared mocks, the script helpers, the margin model with reference values, the Euribor cache and the keeper API on the in-memory vault) | Verified (macOS): 64 keeper tests pass |
| `npm run init-env` | Creates `.env` from `.env.example` if needed and generates the Testnet keys still empty (issuer, bank, keeper). Never generates `FUND_SECRET`, never overwrites a value, prints public keys only | Verified (macOS) |
| `npm run bootstrap` | Idempotent Testnet bootstrap: issuer, bank and keeper accounts (friendbot), bank trustlines, KMMF and KBOND Stellar Asset Contracts, and, when `FUND_SECRET` is set, fund trustlines and issuance up to 1 000 units of each asset (the fund address is derived from `FUND_SECRET`). Writes `deployments/testnet.json` | Verified (macOS) over seven runs (the first stopped on a bug, since fixed); once everything exists, a run sends no transaction |
| `KEEPER_BACKEND=testnet SIGNER=keeper npm run keeper` | Starts the keeper API on `http://127.0.0.1:8787/api` on the **real vault** (C2 build, from `deployments/testnet.json`): `POST /session` deploys a new vault from the recorded WASM hash, deposits and withdrawals are signed with the local demo fund key, `post_margin` with the keeper key, and every `chain` entry of the SSE feed carries the hash of a transaction confirmed by the RPC. Needs `KEEPER_SECRET` and `FUND_SECRET` in the local `.env` (checked against `deployments/testnet.json`). Routes: `/health`, `/config`, `/session` (POST, GET), `/session/deposit`, `/session/withdraw`, `/session/deposit/prepare`, `/session/withdraw/prepare`, `/session/submit`, `/session/rate-shock`, `/session/settle-default` (permissionless `settle_default`, submitted by the keeper account), `/events` (SSE) | Verified (macOS): boots, `/health`, `/session` without session → `NoSession`; the transactions behind it are proven by the integration run below. **Do not expose it publicly with `SIGNER=keeper`**: anyone reaching the API would spend the demo fund. The keeper listens on 127.0.0.1 and refuses requests whose Host or Origin is not loopback (CORS and DNS-rebinding protection, tested) |
| `KEEPER_BACKEND=fake npm run keeper` | Same API on an **in-memory fake vault** (rules of `docs/interfaces.md` section 3 simulated; hashes start with `FAKE`, links do not open; nothing is proven by it) | Verified (macOS) with `curl` |
| `npm run integration:c1 -w @keystone/keeper` | Plays scenario 1 on the real C1 vault through the same session code as the API (deploy, deposit 300 KMMF, −50 bp, −30 bp, top-up, +60 bp, withdrawals, +30 bp, final withdrawal), checks `SessionState` against `get_state` after each step and prints the transaction hashes. Spends demo KMMF of the fund, recovered by the final withdrawals | Verified (macOS), 2026-10-25: all checks passed, proofs in section 6 |
| `npm run e2e:scenario2 -w @keystone/keeper` | Plays scenario 2 on a fresh C2 vault with KBOND: deposit 300, −100 bp, refused premature settlement, waits for the real 90 s ledger deadline, `settle_default`, checks the bank balance, the amount in the `defaulted` feed entry, the terminal state and the refusals | Verified (macOS), 2026-10-26: all checks passed, proofs in section 6 |

The keeper builds `packages/vault-client` (generated bindings, `dist/` not versioned) before `start`, `test` and `typecheck`.

Still to come, once they work: the dashboard on the real keeper, a single e2e script chaining both scenarios, and the public deployment (decision A8).

**Keeper model** (`keeper/src/margin.ts`, parameters in `keeper/scenarios/default.json`): flat curve, 20 quarterly periods, `Q = ceil(V / (P × (1 − h)))` in the token's smallest unit, requirement posted only when it moved by at least the MTA (50 000 EUR). The starting rate is the last ECB Euribor 3M observation (`keeper/data/euribor-cache.json` is the versioned fallback seed, shown as `cache`; it is rewritten only when the ECB value changes, so a run may modify it). Reference values for 0, −50 and −80 bp (computed outside the code, in Python with 50-digit decimals) are checked in `keeper/test/margin.test.ts`.

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

**What the dashboard does.** The user picks KMMF or KBOND and starts a session (a new vault). A band of key figures shows the fund's mark-to-market, Euribor and the asset's NAV (both labelled as simulated), the requirement posted on-chain and the cash kept invested, stamped with the keeper's time; the Euribor figure also shows the fixed rate and the rate source. Below: the vault status with its margin-call countdown and actions, the vault itself (coverage ring, available / locked / shortfall, CSA parameters), the rate shocks, deposit and withdraw forms, what happens if a call is not covered, the fund and bank balances, and a live activity feed (`GET /events`). *SIM* entries are computations and never carry a hash; a *TESTNET* entry shows its hash and stellar.expert link only once confirmed. Deposits and withdrawals are prepared by the keeper and signed by the fund in Freighter (Testnet, demo fund account checked before signing); when the keeper runs with `SIGNER=keeper` (public demo URL), the dashboard calls the direct routes and says so in a banner.

Verified so far: both scenarios on the mock keeper; the HTTP and SSE client against a stand-in server serving the shared mocks. **Not tested yet:** the real keeper (API not merged yet) and a real Freighter signature.

**Visual direction.** "Salle de compensation", light version, chosen by the team: white and cool greys, navy for text and primary actions, blue reserved for on-chain proof, violet for simulated values, green / amber / red for the vault status. One typeface, Helvetica Neue, with tabular figures; it ships with macOS and iOS, and other systems fall back to Helvetica then Arial (no font is bundled or downloaded). Design tokens live in `app/src/index.css` (Tailwind CSS v4 `@theme`), base components in `app/src/ui/`.

## 10. Demo instructions

*To be written once the end-to-end flow works.* Two scenarios are planned:

1. **Margin and release (KMMF).** Deposit, rate shock of −50 bp (collateral locked), further −30 bp (margin call, top-up, cured), +60 bp (collateral released and withdrawn).
2. **Default (KBOND).** Deposit, rate shock of −100 bp (margin call), no top-up, 90-second grace period, settlement: the locked collateral is transferred to the bank.

## 11. Workflow

- Each pole works on its branch and opens pull requests into `staging`. No direct commit on `main` or `staging`. Humans merge.
- Every change is reviewed before its pull request by a fresh Claude sub-agent that only sees the diff (Codex on the Windows contract machine), contract pull requests are reviewed by the contract owner with the reinforced checklist plus a final Codex pass, and every change is tested before merge and updates this README when relevant. See [`AGENTS.md`](AGENTS.md) section 7.
- Rules for agents: [`AGENTS.md`](AGENTS.md). Interfaces: [`docs/interfaces.md`](docs/interfaces.md). Decisions: [`docs/decisions.md`](docs/decisions.md). Plan: [`docs/plan.md`](docs/plan.md).

## 12. Progress

Only the status "verified" counts as done, and only with a proof link.

| # | P0 item | Status | Proof |
| --- | --- | --- | --- |
| 1 | Swap + CSA scenario and margin model | Verified (reference-value tests; scenario 1 on the C1 build and scenario 2 on the C2 build, Testnet) | `keeper/test/margin.test.ts`, section 6 |
| 2 | KMMF and KBOND issued on Testnet | Verified | [KMMF issued](https://stellar.expert/explorer/testnet/tx/ec2b3c50209bbdfa0851274c03b6cd339b20fdc86774f170cf76d4a65315a532), [KBOND issued](https://stellar.expert/explorer/testnet/tx/637fa5e953241c7a7a2f474b4239e44871d67e60af667419aff8f16a0f8ff463), [KMMF SAC](https://stellar.expert/explorer/testnet/tx/bc7d9d9a2a15473b5bae6b81461cac9a68003235dea60056605c8b2631df0e11), [KBOND SAC](https://stellar.expert/explorer/testnet/tx/08089cde2ab558289d0a18c8f85817e18297bb40b41c6506c2d109462b47dcd3) |
| 3 | Manual choice of collateral class in the UI | Not started | |
| 4 | Soroban vault: authorized deposit, available / locked accounting | Verified (C1 and C2) | Section 6 tables; 18 Rust tests (contract pole) |
| 5 | Keeper: exposure and margin computation, posting to the vault | Verified (both scenarios, Testnet) | `post_margin` hashes in section 6 |
| 6 | Deposit, lock and release with verifiable results | Verified (Testnet) | [Deposit](https://stellar.expert/explorer/testnet/tx/eaeeb3da25b832b9e7019099fb74e8396f9d07a3bd6e5b638db152a3757cdec2), [lock](https://stellar.expert/explorer/testnet/tx/d575193f3c49bed24541a0f03dde70129c0242b570305440e6bdb2ca2c75a5f0), [release](https://stellar.expert/explorer/testnet/tx/91527a412eae01b080f3fe7b5b076904649613688cfe3964630034cd385d0dbb), [withdrawal](https://stellar.expert/explorer/testnet/tx/7de52778115187c6ecaadcef3eb4cef294ad045b9713e9b13e63012034bd7c4a) |
| 7 | Separate default scenario with on-chain transfer to the bank | Verified (Testnet) | [`settle_default`, 300 KBOND to the bank](https://stellar.expert/explorer/testnet/tx/33793f423facfa6e2968da335558cc9bba2cc296b6ea6e2133b734829309112c) |
| 8 | Real Stellar Testnet transactions shown with proof | In progress | Real hashes flow through the keeper's SSE feed (section 6); the dashboard has not been run against the real keeper yet |
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
