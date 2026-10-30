# Keystone

Keystone is a programmable collateral engine for an OTC interest rate swap between an investment fund and its bank. Instead of keeping cash aside for margin calls, the fund posts tokenized assets it already holds (money market fund shares or sovereign bonds), and a Soroban vault on Stellar locks, releases and, in case of default, transfers that collateral according to deterministic rules.

Built during HackMeridian 2026 (Lisbon, 25–26 October 2026), track Genesis.

> **Project status: working MVP on Stellar Testnet, deployed.** The Soroban vault (C1 deposit/withdraw/margin and C2 default settlement), the keeper API and the dashboard work together: both scenarios were played on Stellar Testnet from a browser, and a deposit and a withdrawal were signed in the Freighter wallet (section 6). The dashboard is live (section 4). Not done: the guarantees of a production system (section 14). The progress table (section 12) is the reference, and a line only says *verified* with a proof.

## 1. Summary

- A swap and its collateral agreement (CSA) are assumed to be already signed. The scenario starts after that.
- The user picks one collateral class: **KMMF** (tokenized money market fund shares) or **KBOND** (tokenized sovereign bond). Both are fictitious assets issued by the team on Stellar Testnet.
- A keeper computes the swap exposure and the required collateral, then posts it to the vault.
- The vault locks what is required, opens a margin call when collateral is missing, releases collateral when exposure falls, and transfers the locked collateral to the bank if a margin call is not met before its deadline.
- Every token movement is a real Stellar Testnet transaction, shown in the dashboard with a link to the explorer (in real mode; the `?demo` simulation sends nothing).

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
| Deposits, withdrawals, margin postings, default settlement | **Real Stellar Testnet transactions** executed by the Soroban vault (in real mode; simulated in the `?demo` and `--mode demo` builds) |
| Proof | Transaction hash and stellar.expert link for every on-chain step |

## 4. Live demo

After signing in, every page load opens the animated landing, including when the shared keeper already has a session. **Reprendre la session** or **Dashboard** opens that dashboard; **Accueil** returns to the landing. These buttons only change the displayed page: they do not create, reset or close a vault, and they send no write request. Starting a new session remains an explicit action.

| What | Where |
| --- | --- |
| **Live web app** (real mode: it talks to the hosted keeper on Stellar Testnet) | <https://keystone-eta-ebon.vercel.app> |
| **Simulated demo** (the whole flow on simulated data, nothing sent to Stellar, no wallet, no code) | <https://keystone-eta-ebon.vercel.app/?demo> |
| Hosted keeper API (read routes are open) | `https://keystone-keeper.onrender.com/api` (`/health`, `/config`, `/market-advisor`, `/session`, `/events`) |

### Judges: try the real Testnet app in three steps

No local installation or environment variables are needed for the hosted app. These are **deliberately public, disposable Testnet demo credentials**, shared by the team for jury testing. Use Stellar Testnet only; never use this wallet for real assets. A separate browser profile avoids replacing a personal Freighter wallet.

1. Install [Freighter](https://www.freighter.app/) and switch its network to **Testnet**.
2. Import our demo wallet using this recovery phrase (12 words, in order):

   ~~~text
   august gown square view someone ribbon cook fluid shrimp thought victory stock
   ~~~

   Select the first account and check that the fund address is:

   ~~~text
   GDQ6AWAXZWIOCBHDSFIIKCWV3PQ6ZJE6BBC4VJCWA3SCFB4G7A2TMQOY
   ~~~

3. Open [the live app](https://keystone-eta-ebon.vercel.app/) **without ?demo**. Sign in with **demo@keystone.app**, password **stellar**. When asked for the access code, paste:

   ~~~text
   8b9c3e228516c38af259ea826b5da41d219576350a846faa
   ~~~

   Connect the imported fund account in Freighter. Both the app and Freighter must say **Testnet**. **Reprendre la session** / **Dashboard** opens the current vault; **Accueil** returns to the presentation. Deposits and withdrawals ask for your Freighter signature; vault creation, rate shocks and default settlement are submitted by the keeper. Confirmed transactions have **On-chain** badges and Explorer links.

**Short real scenario:** if the current vault is already Defaulted, start a new **KBOND** session, deposit **50 KBOND** (within the displayed balance), then apply **−100 bp**. Do not top up. After the ledger's 90-second grace period, hold **Settle default** until confirmed; inspect its Explorer link and the bank balance. Settlement transfers the locked demo tokens to the bank. Both full scenarios and their existing proofs are in section 6; the general guide is in section 10.

**One shared real demo:** all visitors use the same fund and keeper session, so test one person at a time. Starting a new session replaces the displayed vault, not the old on-chain contract. Withdraw eligible free collateral before leaving a funded vault. Balances change during tests; tokens sent to the bank are not automatically returned. For independent or repeatable testing use [the simulated demo](https://keystone-eta-ebon.vercel.app/?demo): same interface, no wallet/code, no Stellar transaction.

**Troubleshooting:** allow up to a minute for the free hosted keeper to wake. For wrong-account/network errors select the fund above and Testnet in Freighter. For Unauthorized, re-enter the access code. Deposit no more than the displayed fund balance. If another visitor changes the shared session, reload and inspect the current vault before acting.

**Real mode and simulated demo: the same app, two keepers.** The dashboard talks to "a keeper" through one interface (`docs/interfaces.md` section 4). Two implementations stand behind it:

| | **Real mode** (`/`) | **Simulated demo** (`/?demo`) |
| --- | --- | --- |
| Who answers | The hosted keeper (Fastify, on Render), which talks to Stellar Testnet | A mock keeper that runs **inside your browser tab** (`app/src/api/mock.ts`) |
| Transactions | Real Stellar Testnet transactions: vault deployment, deposit, margin posting, release, default settlement. Shown as **On-chain** with a stellar.expert link | None. Nothing leaves the page; every address and hash starts with `MOCK`, shown as **Demo tx** with no link |
| Rules and numbers | The Soroban vault and the keeper's margin model | The same margin formula and the same vault rules (locked, released, margin call, 90 s grace period, default), re-implemented for the browser |
| Who can use it | Anyone can read it (landing, Market Advisor, the running session). Acting needs a team access code, and deposits and withdrawals are signed in Freighter by the demo fund account | Anyone, with no code and no wallet. Each visitor has their own session; a reload resets it |
| Where to see it work | Section 6 (every step with its hash) | Open the link and play both scenarios |

**Why a simulated demo exists.** Real mode spends Testnet fees and moves tokens held by one fund account, so it cannot be left open to anyone: the keeper's actions need a code, the fund's deposits need the shared demo fund wallet (import instructions above), and the keeper holds a single shared session. The simulated demo lets every judge and mentor try the whole flow at once without any of that. It proves how the product behaves; **the proof that it works on Stellar is section 6 and the video**, not the demo. The page always says which mode it is in: the header reads "Demo data · nothing sent to Stellar" in demo mode and "Stellar Testnet · Keeper connected" in real mode.

**What a judge can do.**

- Open the live app, create a local account (accounts live in the browser, see section 10) and see the landing page, the **Collateral Market Advisor** (real ECB and market data, read-only) and, when a session is running, its dashboard updating live over server-sent events.
- Open the `?demo` link for the full hands-on flow: pick KMMF or KBOND, deposit, move rates, margin call, cure, release, default. Every transaction there is labelled **Demo tx**: nothing is sent to Stellar.
- Check the real transactions in section 6: every on-chain step has a stellar.expert link.

**How the real demo is authorized.** In real mode, deposits and withdrawals are signed in the Freighter wallet by the demo fund account, whose Testnet recovery phrase is intentionally shared above for jury testing, and every action that writes (starting a session deploys a vault) needs a team access code, because the keeper is public and pays Testnet fees. This is deliberate (section 9, *Hosted deployment*). The demo video shows the real flow with Freighter. The hosted keeper runs on a free plan: its first answer after a long idle period can take up to a minute, and the session is restored from KEEPER_DATA_DIR when that storage survives a restart; an ephemeral host can lose it while the vault remains on-chain.

## 5. Architecture and use of Stellar

```
Browser: Dashboard (Vite/React, Freighter)  --REST + SSE-->  Keeper (Node/Fastify)  --signed tx-->  keystone_vault (Soroban, Testnet)
   served by Vercel                              |                |                                    | transfers through the SAC
   Freighter signs the fund's deposits           |                +-- ECB, Yahoo Finance (read-only)   v
   and withdrawals                               +-- hosted on Render      Fund and bank accounts (trustlines)
Bootstrap script --issues KMMF and KBOND--> fund account
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
| Demo fund account (Freighter) | [`GDQ6AWAXZWIOCBHDSFIIKCWV3PQ6ZJE6BBC4VJCWA3SCFB4G7A2TMQOY`](https://stellar.expert/explorer/testnet/account/GDQ6AWAXZWIOCBHDSFIIKCWV3PQ6ZJE6BBC4VJCWA3SCFB4G7A2TMQOY) (trustlines on KMMF and KBOND, issued 1 000 of each; historically held 999 KMMF after the first C1 deposit; current balances change during demo tests) |

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

All three were read back from the Soroban RPC with status `SUCCESS`. After the deposit, the vault reports `available = 10000000` (1 KMMF), `locked = 0`, status `Active`; the vault's KMMF balance went from 0 to `10000000` and the fund's from `10000000000` to `9990000000` (balances read from the SAC by the throwaway script; the transaction itself carries one SAC `transfer` of `10000000` from the fund to the vault), and the transaction emitted one `deposited` event with `{amount: 10000000}`. The deposit was signed with the fund key from a throwaway script (not Freighter, which was exercised later: see the Freighter table below).

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

The `prepare` / `submit` path (wallet signing) was exercised on another vault with the fund key standing in for Freighter (one-off script, not kept in the repository, so not reproducible): deposit [`85d0f132…2eee`](https://stellar.expert/explorer/testnet/tx/85d0f132bb236da6352ca35718ad9302c26aead25b3b73dab2ab95a4eb452eee) and withdrawal [`a6401141…8d91`](https://stellar.expert/explorer/testnet/tx/a640114144b9141cfaa78c76e5daadf30af776245b453cbab433a99f7ebf8d91); an unsigned transaction is refused with `BadRequest`. Freighter itself was exercised later (see the Freighter table below).

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

Scenario 1 played **from the browser** (2026-10-26): the Liquid Glass dashboard (`VITE_USE_MOCKS=false`) against the keeper on the C2 build (`KEEPER_BACKEND=testnet SIGNER=keeper`), on vault [`CBL4SMJN…IERD`](https://stellar.expert/explorer/testnet/contract/CBL4SMJNYNXAFWGBKXMNA5U23PBSAFZ2OUDRD2EALCSCA5Y3GG4GIERD). The steps were driven by clicks on the real dashboard (scripted through the browser console); the API was only used to read the state. All nine transactions were read back from the RPC as `SUCCESS` (ledgers 5391654 to 5391678), the dashboard showed them with the **On-chain** badge and a stellar.expert link, and the fund went from 999 to 999 KMMF.

| # | Action in the dashboard | Transaction | Result |
| --- | --- | --- | --- |
| 1 | Vault deployed (KMMF) by *Start* | [`0e7604e2…3f2d`](https://stellar.expert/explorer/testnet/tx/0e7604e28c10da0a4ec3e2ea138a968a00ca805a71cef2fafefb414c45ef3f2d) | `Active` |
| 2 | Deposit 300 KMMF | [`e00a4b80…5286`](https://stellar.expert/explorer/testnet/tx/e00a4b80d5de4e6d6dc08baa06bc9e1c3fdb4fded1bdfb209a32e280c2a15286) | available 300, fund 699 |
| 3 | Rate shock −50 bp (`post_margin`, epoch 1) | [`be228a00…308b`](https://stellar.expert/explorer/testnet/tx/be228a0067dfeaee5cee803df1d281141aa5570bbab3f4340584ff7447f9308b) | locked 243.7615, free 56.2385 |
| 4 | Rate shock −30 bp (epoch 2) | [`0c960db6…33a0`](https://stellar.expert/explorer/testnet/tx/0c960db6f7f392babcb92a572f171cbfb8b82bace55a585d2d121a780e5c33a0) | required 391.5791, **margin call** (shortfall 91.5791) |
| 5 | Deposit 100 KMMF (cure confirmed about 9 s after the call opened) | [`b651b662…723b`](https://stellar.expert/explorer/testnet/tx/b651b662f4200556cb26975b2243628db34305fe02908911a3969ca5e418723b) | **cured**, locked 391.5791, free 8.4209 |
| 6 | Rate shock +60 bp (epoch 3) | [`a20b4830…940c`](https://stellar.expert/explorer/testnet/tx/a20b483014c5a00c13815da08918ecc108b55e847844ae2dbf2d524349fe940c) | required 98.1948, 293.3843 released |
| 7 | Withdrawal of 301.8052 | [`f3bfc2a1…4016`](https://stellar.expert/explorer/testnet/tx/f3bfc2a1828b618eeabc5b772cee74220587bd7f94a3431e231b0efe937b4016) | fund 900.8052 |
| 8 | Rate shock +60 bp again (epoch 4) | [`27ad4b36…5a6c`](https://stellar.expert/explorer/testnet/tx/27ad4b360b6456d229a16e539e6910f2555cf7142913dbd30cbd5ba540e65a6c) | required 0, 98.1948 released |
| 9 | Withdrawal of 98.1948 | [`0c49c0b2…ac78`](https://stellar.expert/explorer/testnet/tx/0c49c0b2d596ca69aafa7201a60b574e13dbc71728d665cb1bf967b48960ac78) | vault empty, fund back to 999 KMMF |

**Deviation from the planned scenario:** the dashboard has no +30 bp button, so step 8 repeats +60 bp (float rate 3.035 %) instead of +30 bp; the effect is the same (requirement back to 0, remaining collateral released). The margin call was covered, with the cure confirmed about 9 s after the call opened, well inside the 90 s grace period; no `settle_default` was sent. At that point Freighter signing and the default scenario from the browser had not been run; both were run later, in the sections below.

Scenario 2 (default) played **from the browser** (2026-10-26), with at most 50 KBOND engaged, on a fresh C2 vault [`CATMOIWU…DC5B`](https://stellar.expert/explorer/testnet/contract/CATMOIWU2FMO43TGLWH4A6SHCIMVHQ5YYXCV2VUN6ZSQMHHKUJRXDC5B) (keeper `KEEPER_BACKEND=testnet SIGNER=keeper`, dashboard `VITE_USE_MOCKS=false`). The four transactions were read back from the RPC as `SUCCESS`:

| # | Action in the dashboard | Transaction | Ledger | Result |
| --- | --- | --- | --- | --- |
| 1 | Vault deployed (KBOND) by *New session* | [`63d08b12…b3b4`](https://stellar.expert/explorer/testnet/tx/63d08b125bfe0aaf58e67a051c62122fea6393ccd5f46773ec026473e6c2b3b4) | 5391790 | `Active`; fund 700, bank 300 KBOND |
| 2 | Deposit exactly 50 KBOND | [`ef6759a3…4cbb`](https://stellar.expert/explorer/testnet/tx/ef6759a33f74adb9cd21838a20ba4102677ceb46aaab137fa174aa144dcc4cbb) | 5391835 | available 50, fund 650 |
| 3 | Rate shock −100 bp (`post_margin`, epoch 1) | [`f8a34652…e76c`](https://stellar.expert/explorer/testnet/tx/f8a3465224d2300f954f71887877a3bc4fc62207045063c6cfc4592ca9f6e76c) | 5391837 | required 491.3927, 50 locked, shortfall 441.3927, **margin call**, deadline 02:47:42 UTC |
| 4 | Hold-to-settle button, after the ledger deadline (`settle_default`) | [`0c3bd3d7…dd43`](https://stellar.expert/explorer/testnet/tx/0c3bd3d7db474f950a6b4bf3119f78536c5ac89c4a6498c67b811a35589add43) | 5391860 | `Defaulted`; **50 KBOND to the bank** (300 → 350); fund stays at 650 |

The settlement was confirmed after the real 90 s ledger deadline (the keeper account only paid the fee). Its transaction carries one SAC `transfer` of `500000000` (50 KBOND) from the vault to the bank account, and one `defaulted` event `{amount: 500000000}`. Final `get_state`: `Defaulted`, `available`, `locked`, `required`, `shortfall` and `call_deadline` at 0, `epoch` 1. Balances: fund 700 → 650 KBOND, bank 300 → 350 KBOND.

After a reload, the dashboard shows this KBOND session: "Defaulted – Collateral sent to the bank", fund 650 and bank 350 KBOND, and six activity entries (five **On-chain** with an Explorer link, covering the four distinct transactions because the margin posting and the margin call share one hash; one **Sim**), no Demo entry. **Limits:** the clicks were driven through the browser console and the long press by keyboard events on the real button (the tool cannot hold a pointer); the browser pane could not render screenshots, so the visual check comes from the page content, not from images. Freighter signing was tested separately (see the Freighter table below).

Scenario 1 was also replayed on a C2 vault (`CD3MAB27BM57BM5SVGAIM5CTBDJPAVSUHFCKDHNZHBHBMNGI6KX7QAC7`) with all script checks passing; its hashes were not recorded, so that replay is not a proof and the C1-build hashes above remain the reference table. An independent settlement fixture of the contract pole (fictitious KSC1 asset) is in `contracts/keystone_vault/testnet-c2.json`.

**Freighter** (2026-10-26, Testnet): a deposit and a withdrawal of 1 KMMF signed in the Freighter wallet from the dashboard, against a keeper running with `SIGNER=freighter` (the keeper prepares the transaction, the fund signs in the wallet, the keeper submits it). Each transaction was read back from Horizon: `successful`, and for the last two the source account is the demo fund account `GDQ6AW…MQOY`, the invoked function is `deposit` or `withdraw` with `i128` `10000000` (1 KMMF, 7 decimals) on the vault [`CAPZEIRJ…MFX2`](https://stellar.expert/explorer/testnet/contract/CAPZEIRJMFSSXN34DG3XV35H6STUEQZOFAH3MCXYJQ3VSRI4EVGDMFX2):

| Step | Signed by | Ledger | Transaction |
| --- | --- | --- | --- |
| Vault deployed by *Start* (KMMF) | keeper account `GDGUJH…G4TO` | 5394522 | [`044ac4fd…6c64`](https://stellar.expert/explorer/testnet/tx/044ac4fd7d88f2706a99960abdfedd25d0f65620376aa7f74b03ec4fab466c64) |
| `deposit` of 1 KMMF | demo fund account, in Freighter | 5394549 | [`4e423a39…7dc1`](https://stellar.expert/explorer/testnet/tx/4e423a39e4021d3c40a85a1e8ffba09df1ca6cb72c91f6744005ecf3fc3c7dc1) |
| `withdraw` of 1 KMMF | demo fund account, in Freighter | 5394558 | [`30464b3c…8523`](https://stellar.expert/explorer/testnet/tx/30464b3c99c8f87d22835988a3368c56ae1804d5e8ce2b0579df234169598523) |

**Hosted keeper** (2026-10-26): starting a KMMF session from the Vercel deployment of this branch made the keeper on Render deploy a vault on Testnet, vault [`CA6OA3I4…JV7D`](https://stellar.expert/explorer/testnet/contract/CA6OA3I4EPINUCZAVFTPHCQCBH4IQLCYZNHGNJBDWFEQP7IL23PSJV7D), transaction [`e192680a…fdaf`](https://stellar.expert/explorer/testnet/tx/e192680a8e2a0f6dd61da64300ccbf255618e4c188f3d4cd4102c398c48afdaf) (ledger 5395810, signed by the keeper account, status `successful`). The vault holds nothing.

## 7. Repository structure and poles

The project is built by three poles working in parallel, each on its own branch, integrated through pull requests into `staging`.

| Pole | Branch | Folders | Owner |
| --- | --- | --- | --- |
| Soroban contract | `contract/collateral` | `contracts/`, `packages/vault-client/` (generated bindings) | Liel |
| Keeper (financial model, API, Testnet scripts) and documentation coordination | `back/keeper` | `keeper/`, `scripts/`, `packages/shared/`, `deployments/` | Grégoire |
| Dashboard | `front/dashboard` | `app/` | Nathan |

```
README.md                  this file
LICENSE                    MIT licence of the Keystone code
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

**Prerequisites**

- Node.js ≥ 22 and npm (verified on the keeper machine with Node 24.22.1 and npm 11.19.1)
- Rust ≥ 1.91 (Cargo.toml minimum, soroban-sdk 29.0.1), the `wasm32v1-none` target and Stellar CLI 28.1.0 (verified contract build; contract pole only)
- A browser with the Freighter extension set to Testnet (to sign as the fund)

**Installation.** The repository is an npm workspace (`app`, `keeper`, `packages/*`). From the root:

```bash
git clone https://github.com/Lagouze/keystone.git
cd keystone
npm ci
```

npm ci is verified on Windows (Node 24.22.1, npm 11.19.1) and macOS. The committed lockfile provides the reproducible workspace installation.

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
| `KEEPER_ALLOWED_ORIGINS` | keeper | Extra browser origins allowed by CORS (comma separated). loopback origins are allowed locally; a hosted keeper requires configured public origins and rejects loopback origins |
| `KEEPER_HOST` | keeper | Listening address, default `127.0.0.1`. A hosted keeper sets `0.0.0.0`; it then requires `KEEPER_ACCESS_TOKENS`, `KEEPER_ALLOWED_ORIGINS` and `KEEPER_PUBLIC_HOSTS`, refuses `SIGNER=keeper`, a `FUND_SECRET` and localhost origins |
| `KEEPER_ACCESS_TOKENS` | hosted keeper | Access codes (32 characters or more, comma separated) required as `Authorization: Bearer` on every `POST` route |
| `KEEPER_PUBLIC_HOSTS` | hosted keeper | Public host name(s) of the keeper (Host header check) |
| `KEEPER_TRUST_PROXY_HOPS` | hosted keeper | Number of reverse proxies in front of the keeper (default 1), so that a client cannot forge its address |
| `KEEPER_DATA_DIR` | keeper | Where the session file and the Euribor and market caches are kept (a mounted volume when hosted). Default `keeper/data` |
| `VITE_KEEPER_URL` | dashboard | Keeper API base URL. A Vercel build refuses anything but an HTTPS address |
| `VITE_USE_MOCKS` | dashboard | `true` to run on mocks |

## 9. Commands

Only commands that have been run successfully are listed. Run them from the repository root.

| Command | What it does | Status |
| --- | --- | --- |
| `npm run typecheck` | Type-checks every workspace that defines a `typecheck` script (today: `app`, `packages/shared`, `scripts` and `keeper`) | Verified (macOS) |
| `npm test` | Runs the tests of every workspace that defines a `test` script (today: Vitest checks of the shared mocks, the script helpers, the margin model with reference values, the Euribor cache and the keeper API on the in-memory vault) | Verified (macOS): 114 keeper tests and 31 app tests pass |
| `npm run init-env` | Creates `.env` from `.env.example` if needed and generates the Testnet keys still empty (issuer, bank, keeper). Never generates `FUND_SECRET`, never overwrites a value, prints public keys only | Verified (macOS) |
| `npm run bootstrap` | Idempotent Testnet bootstrap: issuer, bank and keeper accounts (friendbot), bank trustlines, KMMF and KBOND Stellar Asset Contracts, and, when `FUND_SECRET` is set, fund trustlines and issuance up to 1 000 units of each asset (the fund address is derived from `FUND_SECRET`). Writes `deployments/testnet.json` | Verified (macOS) over seven runs (the first stopped on a bug, since fixed); once everything exists, a run sends no transaction |
| `KEEPER_BACKEND=testnet SIGNER=keeper npm run keeper` | Starts the keeper API on `http://127.0.0.1:8787/api` on the **real vault** (C2 build, from `deployments/testnet.json`): `POST /session` deploys a new vault from the recorded WASM hash, deposits and withdrawals are signed with the local demo fund key, `post_margin` with the keeper key, and every `chain` entry of the SSE feed carries the hash of a transaction confirmed by the RPC. Needs `KEEPER_SECRET` and `FUND_SECRET` in the local `.env` (checked against `deployments/testnet.json`). Routes: `/health`, `/config`, `/session` (POST, GET), `/session/deposit`, `/session/withdraw`, `/session/deposit/prepare`, `/session/withdraw/prepare`, `/session/submit`, `/session/rate-shock`, `/session/settle-default` (permissionless `settle_default`, submitted by the keeper account), `/events` (SSE) | Verified (macOS): boots, `/health`, `/session` without session → `NoSession`; the transactions behind it are proven by the integration run below. **Do not expose it publicly with `SIGNER=keeper`**: anyone reaching the API would spend the demo fund. The keeper listens on 127.0.0.1 and refuses requests whose Host or Origin is not loopback (CORS and DNS-rebinding protection, tested) |
| `KEEPER_BACKEND=fake npm run keeper` | Same API on an **in-memory fake vault** (rules of `docs/interfaces.md` section 3 simulated; hashes start with `FAKE`, links do not open; nothing is proven by it) | Verified (macOS) with `curl` |
| `npm run integration:c1 -w @keystone/keeper` | Plays scenario 1 on the real C1 vault through the same session code as the API (deploy, deposit 300 KMMF, −50 bp, −30 bp, top-up, +60 bp, withdrawals, +30 bp, final withdrawal), checks `SessionState` against `get_state` after each step and prints the transaction hashes. Spends demo KMMF of the fund, recovered by the final withdrawals | Verified (macOS), 2026-10-25: all checks passed, proofs in section 6 |
| `npm run e2e:scenario2 -w @keystone/keeper` | Plays scenario 2 on a fresh C2 vault with KBOND: deposit 300, −100 bp, refused premature settlement, waits for the real 90 s ledger deadline, `settle_default`, checks the bank balance, the amount in the `defaulted` feed entry, the terminal state and the refusals | Verified (macOS), 2026-10-26: all checks passed, proofs in section 6 |

The keeper builds `packages/vault-client` (generated bindings, `dist/` not versioned) before `start`, `test` and `typecheck`.

Still to come, once they work: a single e2e script chaining both scenarios.

### Run your own Testnet instance (not tested from scratch)

The real mode of this repository uses the team's Testnet accounts and assets (`deployments/testnet.json`), whose demo fund recovery phrase is shared above; issuer, bank and keeper keys are not published. To run the same code against your own accounts, which we have **not** done from a clean checkout:

1. `npm install`, then `npm run init-env`: creates `.env` and generates the issuer, bank and keeper keys.
2. Put the secret key of a **Testnet-only** Freighter account in `FUND_SECRET` (never a real account), fund it with friendbot, and add it to Freighter.
3. `npm run bootstrap`: creates the KMMF and KBOND assets and their contracts, the trustlines and 1 000 of each asset for the fund, and rewrites `deployments/testnet.json` with your IDs.
4. Build and upload the vault contract (`contracts/keystone_vault`, `stellar contract build` then `stellar contract upload`) and record its WASM hash in `deployments/testnet.json` under `vault.wasmHash`.
5. `KEEPER_BACKEND=testnet npm run keeper` and `npm run dev -w @keystone/app` on the same machine, with `VITE_USE_MOCKS=false`.

### Hosted deployment (web app on Vercel, keeper on Render or Railway)

The web app is a static Vite build served by Vercel (`vercel.json`). The keeper is a long-lived Node process (Fastify, server-sent events, session persisted to KEEPER_DATA_DIR) and runs in a container (`Dockerfile`; Railway via `railway.json`, or Render), not as serverless functions. Step-by-step instructions, variables and checks are in [`docs/deploy.md`](docs/deploy.md).

What a hosted keeper does differently from a local one (all covered by tests in `keeper/test/hosted.test.ts`):

- **Write routes need an access code.** Every `POST` returns `Unauthorized` (401) without `Authorization: Bearer <code>`; accepted codes are configured in the host's KEEPER_ACCESS_TOKENS; the dedicated jury demo code is intentionally shared above. The dashboard asks for the code once and keeps it in the browser. CORS and the Host/Origin checks are kept (exact origins only) but are not the authorization.
- **No fund key.** It refuses to start with `SIGNER=keeper` or a `FUND_SECRET`: deposits and withdrawals are always signed in Freighter.
- **The session survives a restart when a persistent volume is mounted.** It is saved in `KEEPER_DATA_DIR` and checked against the vault on-chain when reloaded. On a host without a persistent disk (the free Render plan used for the public demo) it is lost on every restart.
- **Uncertain transactions are reconciled by hash.** The hash is recorded before a keeper-signed transaction is sent; after a timeout (or a restart during the wait) the entry stays `pending`, and no other transaction is sent until the hash is found confirmed, failed or expired.
- **`GET /config` states the backend** (`backend: "testnet" | "fake"`); the page labels a fake backend.

Status: deployed (keeper on Render, web app on Vercel, section 4). `railway.json` is kept as an alternative host: Railway had paused new sign-ups when the demo was deployed, so it was not used.

**Keeper model** (`keeper/src/margin.ts`, parameters in `keeper/scenarios/default.json`): flat curve, 20 quarterly periods, `Q = ceil(V / (P × (1 − h)))` in the token's smallest unit, requirement posted only when it moved by at least the MTA (50 000 EUR). The starting rate is the last ECB Euribor 3M observation (`keeper/data/euribor-cache.json` is the versioned fallback seed, shown as `cache`; it is rewritten only when the ECB value changes, so a run may modify it). Reference values for 0, −50 and −80 bp (computed outside the code, in Python with 50-digit decimals) are checked in `keeper/test/margin.test.ts`.

`packages/shared` (`@keystone/shared`) holds the shared types, an exact copy of [`docs/interfaces.md`](docs/interfaces.md) section 5, and mocks under `@keystone/shared/mocks`: a `KeystoneConfig`, one `SessionState` per vault status and the activity feed of scenario 1. Every address and transaction hash in the mocks is fake and starts with `MOCK`. The package ships TypeScript sources with explicit `.ts` import extensions: Vite, `tsx` and Node 24 load them directly, and a consuming TypeScript project needs `allowImportingTsExtensions` (with `noEmit`) or a bundler resolution.

### Dashboard (`app/`)

The dashboard is the `@keystone/app` workspace; it imports the shared types from `@keystone/shared`. Install from the root with `npm install` (see above), then run from the root. Verified on macOS with Node 24.21 and npm 11.19.

| Command | What it does |
| --- | --- |
| `npm run dev -w @keystone/app` | Starts the Vite dev server on `http://localhost:5173`, talking to the keeper at `VITE_KEEPER_URL` |
| `VITE_USE_MOCKS=true npm run dev -w @keystone/app` | Same, on an in-browser mock keeper: both scenarios play without keeper, wallet or network |
| `npm run demo -w @keystone/app` | **The quickest way to try the site.** Builds the production bundle on the in-browser mock keeper (`--mode demo`, no keeper, wallet, network or `.env` needed) into `app/dist-demo/` (apart from the production build in `app/dist/`), serves it on `http://localhost:4173` by default and opens the browser. Sign in with `demo@keystone.app` / `stellar`. Production build, so this is the fluid version (verified on macOS) |
| `npm run dev:demo -w @keystone/app` | The same demo on the dev server (`http://localhost:5173` by default, hot reload): for editing the front, slower than the build above. Works on Windows too, unlike the `VITE_USE_MOCKS=true …` form |
| `npm run keeper` then `npm run dev -w @keystone/app`, in two terminals on **the same Mac** | The real setup: the root `.env` sets `KEEPER_BACKEND=testnet`, `SIGNER=freighter`, `PORT=8787`, `VITE_USE_MOCKS=false`, `VITE_KEEPER_URL=http://127.0.0.1:8787/api` and the local `KEEPER_SECRET` (never committed). `127.0.0.1` is the machine running the browser, so the keeper and the browser must run on the same computer. The front opens on `http://localhost:5173`. Verified from this front on the real vault for both scenarios and for a Freighter deposit and withdrawal (section 6); the read-only checks of the integration branch also ran with `KEEPER_BACKEND=fake` |
| `npm run build -w @keystone/app` | Type-checks, then builds the static site into `app/dist/` |

The root `npm run typecheck` also covers the dashboard.

**Configuration.** The dashboard reads these variables from the root `.env` (or the shell); only `VITE_*` variables reach the browser bundle, and they are fixed at build time.

| Variable | Purpose |
| --- | --- |
| `VITE_KEEPER_URL` | Keeper API base URL, default `http://localhost:8787/api` |
| `VITE_USE_MOCKS` | Exactly `true` to use the in-browser mock keeper (mock data, nothing sent to Stellar, every hash starts with `MOCK`) |
| `?demo` in the page address | Not a variable: plays the whole flow on the in-browser mock for that visit, on any build (used for the public simulated demo) |
| `VITE_MOCK_SIGNER` | Mocks only: `keeper` plays the `SIGNER=keeper` fallback; otherwise the Freighter flow, with the signature simulated |

**Navigation.** Every opening or reload shows Nathan's animated landing first, after unlocking if necessary, even when the keeper already has a session. **Reprendre la session** or **Dashboard** opens that session; **Accueil** returns to the landing while the same session and event stream remain active. Receiving a session through GET or SSE never changes the page. These controls send no POST and do not reset the vault or its activity. Only an explicit **Start** / **Start a new session** action creates a vault; **New session** still opens the collateral picker before its separate **Start** confirmation. A failed start leaves the current page open. The same navigation applies to `?demo`, with the existing visible demo labels. Mock sessions remain in memory and disappear on reload, as before; the keeper's existing session can be resumed after a reload.

**What the dashboard does.** After the landing page, the user resumes a session or picks KMMF or KBOND and starts a session (a new vault). The screen shows the vault status with its margin-call countdown and actions, the vault (coverage bar, free / locked / missing, the fund's token balance and, next to it, what the bank owes the fund in cash when the swap moves in the fund's favour, simulated because only the fund's side is collateralized on-chain; after a default, the tokens the bank received instead), the market figures (fund P&L, Euribor, cash kept invested, all simulated), rate shocks, deposit and withdraw, and the latest activity (`GET /events`). *Sim* entries are computations and never carry a hash; an *On-chain* entry shows its hash and stellar.expert link only once confirmed. Deposits and withdrawals are prepared by the keeper and signed by the fund in Freighter (Testnet, demo fund account checked before signing); when a local keeper runs with `SIGNER=keeper` (the public real demo uses `SIGNER=freighter`), the dashboard calls the direct routes and says so in the header. The header shows **Stellar Testnet** and the keeper's real state (*Connecting…*, *Keeper connected* while the event stream is open, *Reconnecting…*, *Keeper unreachable*); in mocks mode it shows *Demo data · nothing sent to Stellar* and *Mock keeper* instead, and the hashes are fake (`MOCK…`). Before asking Freighter for a signature, the dashboard refuses a deposit above the fund's balance or a withdrawal above the available collateral, and refuses a new deposit or withdrawal for about three minutes after a previous one ended without confirmation (an RPC timeout): a prepared transaction stays valid 180 s, so it may still land in that window.

**Navigation regression tests.** After `npm ci`, run `npm run test:browser -w @keystone/app`. Playwright needs Chromium installed (`npx playwright install chromium`, not tested here), or an installed Chromium browser selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Tests start a disposable HTTP/SSE keeper double and Vite on loopback ports 18787 and 4178, block non-local browser requests, and cover desktop/mobile navigation, all three vault statuses, GET/SSE arrival, reload, unlock, explicit session creation, failed creation and `?demo`. They count POST requests: Home/Resume must send none. No public keeper write or Stellar transaction is involved. Browser output is kept under ignored `app/test-results/`.

Navigation validation (2026-10-26): 18 Playwright tests passed with installed Google Chrome on macOS, at 1440 × 900 and 390 × 844; screenshots of the landing, collateral chapter and dashboard were inspected. Home/Resume sent zero POST requests. `npm ci`, `npm run typecheck`, all 174 unit tests (`npm test`) and `npm run build -w @keystone/app` passed. This covers navigation on a phone-sized viewport; physical phones, other browsers and the hosted deployment are not tested by this change.

Verified in a browser (integration branch, 2026-10-26): both scenarios on the mock keeper (KMMF deposit, margin call, cure, release, withdrawal; KBOND margin call, deadline, settlement); against a running keeper (`KEEPER_BACKEND=fake`, read-only: config, session, event stream, Market Advisor, loss and return of the keeper), with no POST sent. Since then, both scenarios were played from this front on the real vault (section 6), and a deposit and a withdrawal were signed with the Freighter wallet (section 6). **Not tested:** the Freighter flow from the hosted web app (the hosted keeper deployed a vault from the live app, section 6), and a phone-sized screen.

**Lock screen.** The dashboard opens behind a lock screen in the style of the Mac login (`app/src/auth/`). Demo account: `demo@keystone.app` / `stellar`. *Create an account* adds an email and password; an email already registered (case-insensitive) is refused with *An account already exists for this email.* *Forgot password?* runs the local recovery described below (demo code shown on screen, no email). Accounts live in [PGlite](https://pglite.dev) (PostgreSQL compiled to WebAssembly, Apache-2.0) stored in the browser's IndexedDB (`keystone-auth`); passwords are hashed with PBKDF2-SHA256 (210 000 iterations, random salt). The unlocked user is kept in `sessionStorage`, so closing the tab locks again; the lock button in the header locks at once. This is a demo gate, not a security boundary: accounts exist only in that browser, and the keeper API itself has no authentication.

**Real or demo transactions.** Only a confirmed keeper entry carrying a genuine Stellar hash (64 hexadecimal characters) and an https explorer link ending with that hash is shown as **On-chain** with a stellar.expert link (`app/src/lib/proof.ts`, tested in `app/test/proof.test.ts`). With `VITE_USE_MOCKS=true`, or when the keeper runs its in-memory backend (`FAKE…` hashes), the transactions are shown as **Demo tx** with a muted `Demo · MOCK…0008` label and no link: nothing was sent to Stellar. Simulated computations stay **Sim**.

**Visual direction.** "Liquid glass", chosen by the team: frosted panels (translucent white, 24 px backdrop blur, no contour, large diffuse shadows) floating over a slow animated aura of three soft colours, rounded Apple-like shapes, deep anthracite text, sober green and red, and one blue reserved for what is on-chain. No grid, no hard boxes and no badges: statuses and categories are letter-spaced type with a small dot. One typeface, Helvetica Neue, with tabular figures. The lock screen has no panel: the team's logo (an arch in two parallel lines with a faceted keystone set point down at its crown, redrawn as SVG in `app/src/ui/Logo.tsx`, also the favicon), the name in widely spaced capitals and two glass fields float large on the aura; the dashboard has the status panel (the margin-call countdown sits on the headline), the vault (three figures and one linear coverage bar), a single **Controls** panel (rate shocks, then deposit or withdraw), the market figures and an activity list that scrolls inside its card, so both columns end on the same line. Loading shows shimmering glass skeletons shaped like what is coming: the landing's hero (chip, headline bars, buttons) while the keeper's configuration loads, and the lock screen's fields while the local database (PGlite) opens. Four React Bits Pro effects, recreated from the reference recordings, sit where they carry meaning: **Vapor Type** (the words Lock, Call, Settle condense out of vapor and drift away, under the landing headline), **Ghost Type** (the landing sentence writes itself, a grey completion is accepted with Tab), **3D Text Reveal** (the three story steps turn on a 3D cylinder as you scroll, beside a track of three points that join one after the other) and **Animated List** (a new activity entry drops in on a spring, the others make room, the bottom of the list fades out). With reduced motion they render as plain text. The landing also follows the other references: a three-moment **timeline with checklist cards** (Lock, Call, Settle) and a **How it works** section with four numbered steps; in the dashboard the rate shocks are **icon tiles** and the Fund P&L is a **stat card with a trend line** of the session. Swap terms, CSA parameters, contract and timestamps sit behind **Details**. The landing is one screen per chapter, sized to the window with a fluid type scale (`title-hero`, `title-section`, `text-lead` in `index.css`): the hero, the pinned story (Lock, Call, Settle), the timeline, How it works, then the collateral choice, centered, which grows from a card to the whole screen. On screens at least 768 × 720 px, each chapter is pinned for one screen and fades out before the next fades in, so two chapters are never on screen together; on smaller screens and with reduced motion they simply follow each other, one screen each. Design tokens live in `app/src/index.css` (Tailwind CSS v4 `@theme`), base components in `app/src/ui/`. **Rendering budget.** The aura's softness is drawn by its gradients (no `filter: blur`) and its drift pauses while the page scrolls; a glass control inside a glass panel does not blur a second time; filters are removed once an effect ends (no lingering `blur(0px)`); the rolling digits create no compositor layers at rest; panels glide to their new height instead of pushing the page; the dashboard panels are memoized, so an SSE update re-renders only what changed. Development mode (`npm run dev`) is several times slower than the production build because of React's development checks: judge fluidity on `npm run build -w @keystone/app` then `npx vite preview` in `app/`.

**Motion.** Each confirmed change plays one short sequence instead of everything at once (`app/src/state/useChoreography.ts`): the status flips first (at 400 ms after the confirmation arrives), then the figures roll (at 1 s, or at 400 ms when the status does not change), then a margin-call card lights up (at 1.35 s) and its countdown starts (at 1.55 s); on a default, the locked collateral travels from the vault to the bank in 700 ms. Actions stay disabled while a sequence plays. Market figures (MTM, Euribor) move as soon as they arrive; a hash decrypts when an entry seen pending in this tab confirms. The animations come from [React Bits](https://reactbits.dev) (Counter, SplitFlapText, StatusMark, DecryptedText, LatticeLoader, StarBorder, HoldButton, ShinyText, Stepper, CountUp, SwipeToast), copied under `app/src/ui/bits/` with their licence notice, and configured once in `app/src/ui/motion.tsx`. With reduced motion, new values show at once.

### Collateral Market Advisor

On Landing, **Compare market conditions** opens a read-only assistant; once a session is running, the **Market** button in the dashboard's top bar opens the same assistant, so it can be shown at any time without ending the session. It shows five indicator slots, observation/retrieval dates, source links, availability, publication frequency, cache/freshness labels, indicative class scores and assumptions. Closing it leaves the manual collateral selection unchanged. Only the separate Start button creates a vault. No wallet is needed for the assistant, and its only request is `GET /api/market-advisor`; it never calls a Stellar write route. With `VITE_USE_MOCKS=true`, session scenarios remain mocked while the advisor still requests real market observations from the configured keeper (or shows insufficient data if it is unavailable).

| Indicator | Actual source / interpretation |
| --- | --- |
| VIX | [Yahoo Finance / Cboe daily history](https://finance.yahoo.com/quote/%5EVIX/history/), ticker `^VIX`, fetched automatically from `https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=5d`. Uses the latest valid completed daily `close` aligned with its timestamp, dated in the exchange timezone. An open session's daily bar and `regularMarketPrice` are never treated as a close. US equity implied volatility is used only as secondary stress, not direct bond risk. |
| Sovereign realized yield volatility | Keystone calculation from the [ECB AAA euro 2Y spot yield history](https://data.ecb.europa.eu/data/datasets/YC/YC.B.U2.EUR.4F.G_N_A.SV_C_YM.SR_2Y): sample standard deviation of 20 daily yield changes × 100, using 21 observations, in **bp/day**, not annualized. Window dates/count are displayed. This is **not MOVE** (nor implied price volatility); no keyless licensed MOVE feed was configured. See [ICE's MOVE service](https://developer.ice.com/fixed-income-data-services/catalog/ice-data-indices-move-index). |
| Euribor 3M | [ECB monthly average](https://data.ecb.europa.eu/data/datasets/FM/FM.M.U2.EUR.RT.MM.EURIBOR3MD_.HSTA), reusing the keeper's series URL and milli-percent parser. This is the last published month, rounded to the existing parser's precision, **not today's fixing**. Underlying Refinitiv / EMMI attribution is retained. No margin inputs are changed. |
| Euro sovereign 2Y yield | [ECB fitted AAA spot curve](https://data.ecb.europa.eu/data/datasets/YC/YC.B.U2.EUR.4F.G_N_A.SV_C_YM.SR_2Y), daily, percent per annum with continuous compounding. Not a specific traded bond, coupon or KBOND yield. |
| €STR | [ECB overnight benchmark](https://data.ecb.europa.eu/data/datasets/EST/EST.B.EU000A2X2A25.WT), daily, percent per annum. |

**Reproducible scoring:** `keeper/src/market-scoring.ts` exports `DEFAULT_WEIGHTS` and accepts a validated `AdvisorWeights` override; server integrations can inject a provider with custom weights, without accepting browser-supplied weights. Defaults: duration 35, indicative stability 20, unmeasured liquidity 10, yield environment 25, collateral valuation uncertainty 10. Each criterion exposes its two scores, weight, influencing indicators and explanation. These are demo heuristics, not calibrated risk estimates.

Let `s = clamp((realized bp/day − 3) / 9, 0, 1)`, `y = clamp((2Y − mean(Euribor, €STR)) / 0.75, −1, 1)`, and `v = clamp((VIX − 20) / 20, 0, 1)` (zero when VIX is unavailable). KMMF/KBOND criterion scores: duration `80 / (80−60s)`; stability `75 / (75−50s)`; liquidity `50 / 50`; yield `(50−50y) / (50+50y)`; valuation `(50−5v) / (50−20s−10v)`. Weighted means are rounded to two decimals. A gap below 8 points returns **No clear preference**. Missing/stale core data returns **Insufficient market data** with no scores; VIX is optional and changes the default final score gap by at most 0.5 points. Calm conditions plus a sufficient sovereign yield premium can favour KBOND; high rate volatility or a money-market yield advantage can favour KMMF.

Assumptions: short-duration EUR money market fund versus two-year EUR sovereign exposure. Duration and stability share a proxy and are not independent evidence. Liquidity is neutral because no redemption/order-book data exists. Different maturities, observation frequencies and compounding conventions make the yield comparison approximate; it is not expected total return. Credit, custody, legal, fund NAV and redemption-gate risks are not quantified. KMMF and KBOND remain fictitious Testnet tokens with identical simulated prices and haircuts. No actual Etherfuse Stablebond is integrated. **Indicative comparison only, not investment advice.**

**Operation:** no new package or paid key is required. Start the existing keeper and app with the usual environment; the new route works without a demo session. Yahoo VIX is enabled automatically; no `MARKET_VIX_ENABLED` setting is needed. Network requests are server-side, fixed-source and parallel, each with a six-second timeout. Optional observations persist in ignored `keeper/data/market-cache.local.json`. Refresh interval is one hour; the Refresh button may reuse that explicitly dated cache. Failed refreshes retain original observation and retrieval dates, including Yahoo failures/rate limits. Old Cboe CSV VIX cache entries are not relabelled as Yahoo data; existing ECB cache entries remain usable. Daily data older than seven calendar days, or monthly data older than 45 days after month end, is stale and excluded from scoring. Future/invalid data and incomplete volatility history are rejected; no fabricated fallback exists. ECB, Yahoo and underlying third-party reuse conditions still apply to any public/commercial redistribution; no public deployment is performed by this feature.

Validation commands: `npm ci`, `npm run typecheck`, `npm test`, `npm run build -w @keystone/app`. Unit tests cover CSV/Yahoo JSON parsing, latest completed VIX close/date and exchange timezone, exact proxy calculation, missing/stale/offline/timeout data, cache persistence/provenance, secondary VIX scoring, four outcomes, configurable weights, preserved origin checks and a read-only route with no session or activity mutation. Browser results and limits are recorded in the feature PR. Existing on-chain proofs above are unchanged; these checks send no Stellar transactions.

## 10. Demo instructions

**Try it online, no install:** <https://keystone-eta-ebon.vercel.app/?demo> (simulated, nothing sent to Stellar). Create a local account on the lock screen, or use `demo@keystone.app` / `stellar`. **Try it on your machine in two commands:** `npm install`, then `npm run demo -w @keystone/app` (builds and opens the same simulated demo on `http://localhost:4173`). The real, on-chain setup needs a Testnet keeper and a Freighter wallet and is described in section 9.

Two scenarios are played, simulated in the demo and real on Stellar Testnet (section 6 has the hashes):

1. **Margin and release (KMMF).** Deposit, rate shock of −50 bp (collateral locked), further −30 bp (margin call, top-up, cured), +60 bp (collateral released and withdrawn).
2. **Default (KBOND).** Deposit, rate shock of −100 bp (margin call), no top-up, 90-second grace period, settlement: the locked collateral is transferred to the bank.

### Local demo accounts and recovery

The arrival screen uses PGlite (PostgreSQL WASM) in this browser's IndexedDB. It is a demo screen gate, **not centralized authentication and not authorization for keeper write routes**. No email is sent. Existing accounts and their PBKDF2-SHA256 hashes (210,000 iterations, individual random salts) remain compatible, including `demo@keystone.app` / `stellar`.

Sign up requires a valid normalized email, at least 10 password characters and matching confirmation. PostgreSQL's email primary key enforces uniqueness, including concurrent requests. Existing shorter passwords still sign in. Eye buttons toggle each password independently. The current user survives reload in the same tab via `sessionStorage`; Lock clears it, and closing the tab locks again. If IndexedDB is blocked, the existing in-memory fallback loses accounts on reload.

**Forgot password** is explicitly a local demonstration: enter an email, view **Demo recovery code** for a matching local account, enter that code, then choose and confirm a new password. A cryptographically random 48-bit code expires after ten minutes and permits five attempts. Verification consumes it and issues a random 192-bit reset grant with the same deadline. Successful reset consumes that grant atomically. Resending invalidates previous codes and grants. Codes/grants are stored as SHA-256 hashes; new passwords use the same salted PBKDF2 format. Anyone controlling this browser/database can recover a local account; this is not proof of email ownership and must not be used for production access control.

**Development account maintenance:** after opening the lock screen with `npm run dev -w @keystone/app`, the developer console exposes `window.keystoneDemoAccounts`. `await ...list()` returns email and creation date only; `await ...resetPassword(email, newPassword)` changes one local password; `await ...deleteAccount(email)` deletes one test account. `await ...resetDatabase('RESET LOCAL DEMO ACCOUNTS')` clears only this demo database and recreates the default demo account. These actions clear the stored local session; reload to show the lock screen if already unlocked. No keeper/admin HTTP route exists. This module is excluded from production builds. Use only disposable test accounts in the console; do not paste real credentials or logs.

**Supabase: migration prepared, not implemented or tested.** No Supabase project/public configuration was available for this change. Merely adding variables does not switch modes. To build a separate central provider:

1. Create a Supabase project and enable email/password Auth; configure a working SMTP sender for real emails. Configure Site URL and an exact allowed recovery redirect such as `http://localhost:5173/account/update-password` (use the final HTTPS URL when deployed).
2. Add public build variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the ignored root `.env` (a legacy public anon key may be used instead). Never add a service-role, secret or database connection key to a `VITE_*` variable.
3. Add the official `@supabase/supabase-js` client behind an explicit provider selection; use `signUp`, `signInWithPassword`, `signOut`, `getSession` and `onAuthStateChange` instead of local session strings. Keep local demo mode separate and visibly labelled. No automatic upload of browser accounts/password hashes: users register centrally or use an email-based recovery/invitation flow.
4. Use `resetPasswordForEmail(email, { redirectTo })`, then complete the recovery callback and call `updateUser({ password })` only with the authenticated recovery session. Never display a recovery code in central mode. See [Supabase password flows](https://supabase.com/docs/guides/auth/passwords) and [redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).
5. Enable Row Level Security on any application profile table; authorize per `auth.uid()`. Admin resets/deletions belong in the restricted Supabase dashboard or a server endpoint with verified admin authorization, never in public frontend code. Protect keeper writes separately with server-side session/token verification, role checks and transaction-signing policy before connecting it to centralized auth.

Validation commands: `npm ci`, `npm run typecheck`, `npm test`, `npm run build -w @keystone/app`. Auth tests use an actual in-memory PGlite database and Web Crypto; they cover normalization, concurrent duplicates, old accounts, generic sign-in failure, reset expiry/replay/concurrency/attempt limits and tab session storage. Browser checks and any remaining limits are recorded in the feature PR. No Stellar transaction is needed for these checks.

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
| 3 | Manual choice of collateral class in the UI | Verified (the choice KMMF or KBOND starts the matching vault, in a browser on Testnet) | KMMF session [`0e7604e2…3f2d`](https://stellar.expert/explorer/testnet/tx/0e7604e28c10da0a4ec3e2ea138a968a00ca805a71cef2fafefb414c45ef3f2d), KBOND session [`63d08b12…b3b4`](https://stellar.expert/explorer/testnet/tx/63d08b125bfe0aaf58e67a051c62122fea6393ccd5f46773ec026473e6c2b3b4) |
| 4 | Soroban vault: authorized deposit, available / locked accounting | Verified (C1 and C2) | Section 6 tables; 18 Rust tests (contract pole) |
| 5 | Keeper: exposure and margin computation, posting to the vault | Verified (both scenarios, Testnet) | `post_margin` hashes in section 6 |
| 6 | Deposit, lock and release with verifiable results | Verified (Testnet) | [Deposit](https://stellar.expert/explorer/testnet/tx/eaeeb3da25b832b9e7019099fb74e8396f9d07a3bd6e5b638db152a3757cdec2), [lock](https://stellar.expert/explorer/testnet/tx/d575193f3c49bed24541a0f03dde70129c0242b570305440e6bdb2ca2c75a5f0), [release](https://stellar.expert/explorer/testnet/tx/91527a412eae01b080f3fe7b5b076904649613688cfe3964630034cd385d0dbb), [withdrawal](https://stellar.expert/explorer/testnet/tx/7de52778115187c6ecaadcef3eb4cef294ad045b9713e9b13e63012034bd7c4a) |
| 7 | Separate default scenario with on-chain transfer to the bank | Verified (Testnet) | [`settle_default`, 300 KBOND to the bank](https://stellar.expert/explorer/testnet/tx/33793f423facfa6e2968da335558cc9bba2cc296b6ea6e2133b734829309112c); also from the browser: [`settle_default`, 50 KBOND to the bank](https://stellar.expert/explorer/testnet/tx/0c3bd3d7db474f950a6b4bf3119f78536c5ac89c4a6498c67b811a35589add43) |
| 8 | Real Stellar Testnet transactions shown with proof | Verified (both scenarios from the browser) | Nine KMMF and four KBOND transactions with On-chain badges and Explorer links in section 6 |
| 9 | Dashboard showing asset choice, steps and on-chain proof | Verified on the real keeper for both scenarios (Liquid Glass UI in a browser); Freighter deposit and withdrawal verified (section 6) | [KMMF deposit](https://stellar.expert/explorer/testnet/tx/e00a4b80d5de4e6d6dc08baa06bc9e1c3fdb4fded1bdfb209a32e280c2a15286), [KMMF cure](https://stellar.expert/explorer/testnet/tx/b651b662f4200556cb26975b2243628db34305fe02908911a3969ca5e418723b), [KBOND settlement](https://stellar.expert/explorer/testnet/tx/0c3bd3d7db474f950a6b4bf3119f78536c5ac89c4a6498c67b811a35589add43) |
| 10 | End-to-end integration of the three poles | Verified (the Freighter flow from the hosted web app is not tested) | Browser → keeper → C2 vault proven for both scenarios, Freighter deposit and withdrawal signed in the wallet, hosted keeper (Render) deploying a vault from the Vercel app (section 6) |
| 11 | Submission: public repo, README, public URL, video, pitch deck | Verified for the public repo, the README and the live URL; the video and the pitch deck are not part of this repository | Section 4 |
| 12 | Continuous quality: review of every PR, tests, README updates | In place from phase zero | This repository's PR history |

## 13. Prior work and work done during the event

**Before the event:** the idea, a written brief, an empty repository skeleton (folders and a PR policy workflow for `main`), and a test Soroban contract built in a separate project to check the toolchain.

**During the event (25–26 October 2026):** the documentation and interfaces of phase zero, and all application code (contract, keeper, dashboard, scripts). See the commit and pull request history of this repository.

**AI assistance.** The code was written by the team with AI coding agents (Claude Code on two machines, Codex on the third), under the rules in [`AGENTS.md`](AGENTS.md), and reviewed with fresh AI sub-agents (section 11).

**Third-party code.** [React Bits](https://reactbits.dev) components under `app/src/ui/bits/` (MIT with the Commons Clause, licence notice kept in the files), [PGlite](https://pglite.dev) (Apache-2.0), Stellar SDK, Fastify, React, Vite and Tailwind CSS, each under its own licence (see `package-lock.json`).

## 14. Known limits

- The swap model uses a flat curve, no coupon cash flows, one-way variation margin (fund to bank), no initial margin.
- The keeper is trusted for the margin requirement value (bounded by a cap set at deployment). It cannot move funds.
- The default is a simplified rule (margin call not met before a short grace period), not a full CSA close-out.
- KMMF and KBOND are fictitious; they carry no real economic rights.
- **Etherfuse Stablebonds were tested and dropped:** on 25 October, an order of sandbox CETES on Etherfuse's API v2 was funded but never delivered to Stellar Testnet. The Etherfuse team confirmed this part of v2 was not finished before the submission deadline, so KBOND represents the bond class instead.
- **The contract is not audited.** The C2 settlement change was reviewed by automated AI reviewers (decision A11 in `docs/decisions.md`), not by an independent human auditor, and two reserves remain open: a token trustline or freeze can block `withdraw` and `settle_default` (`docs/interfaces.md` section 3.7), and the contract instance TTL must be extended on a long-lived deployment.
- The public demo is not a production system: the hosted keeper is a single instance on a free plan (idle wake-up delay, session can be lost when storage is ephemeral), actions need an access code (the public jury code above is shared; there are no per-user server accounts), and the read routes (`/session`, `/events`) are public Testnet data. Local accounts live in each browser (PGlite) and are not an authorization.
- Testnet only. No real money, no Mainnet.

## 15. Licence

The code written by the Keystone team is released under the [MIT licence](LICENSE). Third-party code keeps its own licence: the React Bits components under `app/src/ui/bits/` are MIT with the Commons Clause ([`app/src/ui/bits/LICENSE.md`](app/src/ui/bits/LICENSE.md)), and the dependencies are listed in section 13.
