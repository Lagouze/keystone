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

## Not yet verified

No Testnet upload, deployment or live deposit was executed in this C1 PR task;
the local WASM hash is not proof of an upload. The full C1 on-chain milestone
remains pending. The keeper records deployment IDs and transaction proofs when
provided. C2 settlement and its refusal tests are not implemented in this C1
build; post-default behavior must be validated as part of C2.
