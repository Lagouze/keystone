# Keystone vault — C1

Immutable Soroban vault for Stellar **Testnet only**. Implements the C1 subset
of `docs/interfaces.md` section 3: constructor, deposit, withdraw, post_margin,
and get_state. `settle_default` and its event belong to C2 and are not exported
by this build. The error enum reserves all eight specified codes.

The fund authorizes deposits and withdrawals; the keeper authorizes margin
updates. Amounts are i128 token base units (7 decimals for KMMF and KBOND),
epochs and ledger timestamps are u64. No prices or EUR conversion occur here.
Instance storage TTL is refreshed on successful mutations. There is no admin,
upgrade, arbitrary-recipient or recovery function.

The only C1 outflow is withdraw to the configured fund. Accounting tracks only
deposits made through the vault: available + locked equals the SAC balance in
controlled flows and excludes unsolicited surplus. Direct token transfers do
not cover margin and cannot be withdrawn. An ongoing margin call keeps its
original deadline; coverage after the deadline can still cure it before a
future C2 settlement succeeds.

## Verified locally

Executed on Windows with Rust/Cargo 1.98.1, stellar-cli 28.1.0,
soroban-sdk 29.0.1 and the wasm32v1-none target:

```powershell
cd contracts/keystone_vault
cargo test
stellar contract build
```

- 11 tests passed. Coverage includes every C1 refusal from plan section 12:
  missing/wrong fund and keeper authorizations, nested token authorization,
  over-withdrawal, stale epochs and above-cap requirements; also nonpositive
  amounts, negative requirements, token transfer failure and arithmetic overflow.
- Positive tests cover locking, release, withdrawal, margin-call deadlines,
  partial/late cure, direct-transfer surplus, event topics and named data,
  read-only state access and instance TTL renewal.
- The optimized WASM is 8,048 bytes, with five exports.
- Local WASM hash:
  `173fc4aa48b40a051862a720fa3d4827efd03ad25f4e7549b3314c4cba3f8516`.

Generated bindings are produced from this local WASM, never edited manually.
From the repository root:

```powershell
stellar contract bindings typescript --wasm contracts/keystone_vault/target/wasm32v1-none/release/keystone_vault.wasm --output-dir packages/vault-client --overwrite
cd packages/vault-client
npm install --workspaces=false
npm run build
```

The CLI marks this generator deprecated; it remains the generator requested by
the project plan. Regeneration replaces the generated directory, including
installed dependencies, so install them again before compiling.

## Testnet verification and remaining deposit

Public evidence and constructor arguments are recorded in [testnet-c1.json](testnet-c1.json).
The keeper owns the canonical `deployments/testnet.json`; this evidence file
does not replace it. The team fund, bank, keeper and KMMF SAC were read from
`origin/staging:deployments/testnet.json`.

- WASM upload [cf981253…](https://stellar.expert/explorer/testnet/tx/cf9812534038af3f17741140dcb5963ceae8ef6b6c3645cfe1a1bff2bc35431d)
  was already installed. The CLI skipped reinstall; RPC reports SUCCESS at
  ledger 5387705. Its envelope contains the expected WASM hash, and fetched
  on-chain WASM bytes match the local build exactly.
- Vault `CCLE3RBDYNMRMBVTAPXLQ5JRWQOGR3RHOQYCMH43N6VYY6T2OGSZCB2N`
  was deployed in [66af4894…](https://stellar.expert/explorer/testnet/tx/66af48946f18f1a16673c78eb37a76ace759c1ba0b9ab35ec825df65c9ecbdec),
  confirmed SUCCESS at ledger 5388742. A preconfigured local C1 test identity
  paid the fee; all three vault roles use the team addresses. Cap: 1,000 KMMF
  (`10000000000` base units); grace period: 90 seconds.
- Read-only `get_state` confirms the constructor arguments, Active status,
  zero balances/requirement/epoch/deadline. The KMMF SAC balance is zero.
- Tracked bindings match fresh generation from the local WASM byte for byte;
  their embedded ABI also matches bindings generated from the deployed vault.
- A deposit of 1 KMMF (`10000000` base units), sourced by the project fund,
  simulates successfully. This is **not a confirmed deposit**. No local signing
  identity matches the project fund or its sole authorized signer.

### Deposit handoff to Grégoire

Use an existing authorized fund identity on Grégoire's machine, after verifying
its public address with `stellar keys address fund` is exactly
`GDQ6AWAXZWIOCBHDSFIIKCWV3PQ6ZJE6BBC4VJCWA3SCFB4G7A2TMQOY`.
The following signing/submission step is **not executed on this machine**:

```powershell
stellar contract invoke --id CCLE3RBDYNMRMBVTAPXLQ5JRWQOGR3RHOQYCMH43N6VYY6T2OGSZCB2N --source-account fund --rpc-url https://soroban-testnet.stellar.org --network-passphrase "Test SDF Network ; September 2015" --send yes -- deposit --amount 10000000
```

Do not substitute the local `keystone-c1-fund-20261025`: its address differs
from the configured project fund. Never export or transfer a secret key.

Alternatively, use Freighter with the project fund account on Testnet:

1. Install dependencies in `packages/vault-client` using
   `npm install --workspaces=false` if needed. From the repository root run
   `node contracts/keystone_vault/prepare-deposit.cjs`. This executed helper
   loads a fresh fund sequence, simulates, assembles the resource footprint and
   authorization entries, and prints **unsigned** XDR only on stdout. It neither
   loads a signing identity nor submits. `stellar contract invoke --build-only`
   alone does not assemble the footprint, so do not sign its raw output.
2. Have Freighter sign that XDR through the team's signing UI or Stellar Lab's
   transaction signing flow, on Testnet, with the exact project fund account
   above. Check the vault ID and deposit amount (1 KMMF). The XDR expires after
   180 seconds; regenerate on expiry or a concurrent fund transaction. This
   Freighter signing step is **not tested here**.
3. Save the returned signed XDR locally and submit with
   `stellar tx send --rpc-url https://soroban-testnet.stellar.org --network-passphrase "Test SDF Network ; September 2015" signed-deposit.xdr`.
   This submission step is **not tested here**. Do not publish an expired XDR
   as a reusable transaction.
4. Poll RPC `getTransaction` with the returned hash until SUCCESS or FAILED.
   Only SUCCESS counts as a deposit proof. Before other operations, re-read
   `get_state` and the KMMF SAC balance: available and vault balance should be
   `10000000`, locked/required/shortfall should stay zero, status Active. Confirm
   the fund's SAC balance decreased by the same amount and check `deposited`
   event data `{amount: 10000000}`. Give the confirmed hash to the keeper.

The full C1 milestone remains pending this signed deposit and the keeper's
recording of public deployment evidence. C2 settlement and its refusal tests
are not implemented in this C1 build.
