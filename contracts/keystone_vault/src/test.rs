use super::*;
use soroban_sdk::{
    testutils::{storage::Instance as _, Address as _, Events, Ledger, MockAuth, MockAuthInvoke},
    token, xdr, IntoVal, Map, Symbol, TryFromVal, Val,
};

struct Fixture {
    env: Env,
    vault: Address,
    fund: Address,
    bank: Address,
    keeper: Address,
    asset: Address,
    issuer: soroban_sdk::testutils::StellarAssetIssuer,
    last_events: std::cell::RefCell<soroban_sdk::testutils::ContractEvents>,
}

impl Fixture {
    fn new() -> Self {
        let env = Env::default();
        env.ledger().with_mut(|l| l.timestamp = 1_000);
        let fund = Address::generate(&env);
        let bank = Address::generate(&env);
        let keeper = Address::generate(&env);
        let admin = Address::generate(&env);
        let sac = env.register_stellar_asset_contract_v2(admin);
        let asset = sac.address();
        let issuer = sac.issuer();
        let vault = env.register(
            KeystoneVault,
            (&fund, &bank, &keeper, &asset, 10_000i128, 90u64),
        );
        env.mock_all_auths();
        token::StellarAssetClient::new(&env, &asset).mint(&fund, &100_000);
        env.set_auths(&[]);
        let last_events = std::cell::RefCell::new(env.events().all());
        Self {
            env,
            vault,
            fund,
            bank,
            keeper,
            asset,
            issuer,
            last_events,
        }
    }

    fn client(&self) -> KeystoneVaultClient<'_> {
        KeystoneVaultClient::new(&self.env, &self.vault)
    }

    fn auth(
        &self,
        actor: &Address,
        function: &str,
        args: soroban_sdk::Vec<Val>,
        transfer: Option<i128>,
    ) {
        let sub = transfer.map(|amount| MockAuthInvoke {
            contract: &self.asset,
            fn_name: "transfer",
            args: (&self.fund, &self.vault, amount).into_val(&self.env),
            sub_invokes: &[],
        });
        self.env.mock_auths(&[MockAuth {
            address: actor,
            invoke: &MockAuthInvoke {
                contract: &self.vault,
                fn_name: function,
                args,
                sub_invokes: sub.as_slice(),
            },
        }]);
    }

    fn deposit(&self, amount: i128) -> VaultState {
        self.auth(
            &self.fund,
            "deposit",
            (amount,).into_val(&self.env),
            Some(amount),
        );
        let state = self.client().deposit(&amount);
        *self.last_events.borrow_mut() = self.env.events().all();
        self.assert_balance(0);
        state
    }

    fn margin(&self, epoch: u64, required: i128) -> VaultState {
        self.auth(
            &self.keeper,
            "post_margin",
            (epoch, required).into_val(&self.env),
            None,
        );
        let state = self.client().post_margin(&epoch, &required);
        *self.last_events.borrow_mut() = self.env.events().all();
        self.assert_balance(0);
        state
    }

    fn withdraw(&self, amount: i128) -> VaultState {
        self.auth(&self.fund, "withdraw", (amount,).into_val(&self.env), None);
        let state = self.client().withdraw(&amount);
        *self.last_events.borrow_mut() = self.env.events().all();
        self.assert_balance(0);
        state
    }

    fn settle(&self, surplus: i128) -> VaultState {
        self.env.set_auths(&[]);
        let state = self.client().settle_default();
        *self.last_events.borrow_mut() = self.env.events().all();
        self.assert_balance(surplus);
        state
    }

    fn assert_balance(&self, surplus: i128) {
        let state = self.client().get_state();
        let token = token::Client::new(&self.env, &self.asset);
        assert_eq!(
            token.balance(&self.vault),
            state.available + state.locked + surplus
        );
        if state.status != Status::Defaulted {
            assert_eq!(token.balance(&self.bank), 0);
        }
        assert_eq!(token.balance(&self.keeper), 0);
        assert_eq!(
            token.balance(&self.fund) + token.balance(&self.vault) + token.balance(&self.bank),
            100_000
        );
        assert!(state.available >= 0 && state.locked >= 0 && state.shortfall >= 0);
    }

    fn event(&self, name: &str, expected: Map<Symbol, Val>) {
        // Capture before balance/get_state queries replace the last invocation's events.
        let events = self.last_events.borrow().filter_by_contract(&self.vault);
        let topic: Val = Symbol::new(&self.env, name).into_val(&self.env);
        let topic = xdr::ScVal::try_from_val(&self.env, &topic).unwrap();
        let matching: std::vec::Vec<_> = events
            .events()
            .iter()
            .filter_map(|event| {
                let xdr::ContractEventBody::V0(body) = &event.body;
                (body.topics.as_slice() == [topic.clone()]).then_some(&body.data)
            })
            .collect();
        assert_eq!(matching.len(), 1, "expected exactly one event {name}");
        let expected: Val = expected.into_val(&self.env);
        assert_eq!(
            *matching[0],
            xdr::ScVal::try_from_val(&self.env, &expected).unwrap()
        );
    }
}

fn auth_error<T, E>(
    result: Result<Result<T, E>, Result<soroban_sdk::Error, soroban_sdk::InvokeError>>,
) {
    match result {
        // Native test contract panics are surfaced as Context/InvalidAction.
        // The paired success with the exact role/arguments establishes the auth cause.
        Err(Ok(error)) => assert!(
            error.is_type(xdr::ScErrorType::Auth)
                || error
                    == soroban_sdk::Error::from_type_and_code(
                        xdr::ScErrorType::Context,
                        xdr::ScErrorCode::InvalidAction,
                    ),
            "{error:?}",
        ),
        _ => panic!("expected an authorization error"),
    }
}

fn error_code<T, E: core::fmt::Debug>(
    result: Result<Result<T, E>, Result<soroban_sdk::Error, soroban_sdk::InvokeError>>,
    error: Error,
) {
    match result {
        Err(Ok(actual)) => assert_eq!(
            actual,
            soroban_sdk::Error::from_contract_error(error as u32)
        ),
        _ => panic!("expected contract error {}", error as u32),
    }
}

#[test]
fn initial_state_and_read_without_auth() {
    let f = Fixture::new();
    assert_eq!(
        f.client().get_state(),
        VaultState {
            fund: f.fund.clone(),
            bank: f.bank.clone(),
            keeper: f.keeper.clone(),
            asset: f.asset.clone(),
            available: 0,
            locked: 0,
            required: 0,
            shortfall: 0,
            status: Status::Active,
            epoch: 0,
            call_deadline: 0,
            grace_period_secs: 90,
            max_required: 10_000,
        }
    );
    f.assert_balance(0);
}

#[test]
fn authorization_is_required_and_wrong_roles_cannot_mutate() {
    let f = Fixture::new();
    // Use valid amounts and a funded vault: insufficient funds must not mask auth.
    f.deposit(300);
    let before = f.client().get_state();
    for actor in [None, Some(&f.bank), Some(&f.keeper)] {
        f.env.set_auths(&[]);
        if let Some(actor) = actor {
            f.auth(actor, "deposit", (100i128,).into_val(&f.env), Some(100));
        }
        auth_error(f.client().try_deposit(&100));
        assert_eq!(f.client().get_state(), before);
        f.assert_balance(0);

        f.env.set_auths(&[]);
        if let Some(actor) = actor {
            f.auth(actor, "withdraw", (1i128,).into_val(&f.env), None);
        }
        auth_error(f.client().try_withdraw(&1));
        assert_eq!(f.client().get_state(), before);
        f.assert_balance(0);
    }
    for actor in [None, Some(&f.fund), Some(&f.bank)] {
        f.env.set_auths(&[]);
        if let Some(actor) = actor {
            f.auth(actor, "post_margin", (1u64, 100i128).into_val(&f.env), None);
        }
        auth_error(f.client().try_post_margin(&1, &100));
        assert_eq!(f.client().get_state(), before);
        f.assert_balance(0);
    }
    // Positive controls: the same arguments succeed for the correct signer.
    f.deposit(100);
    f.margin(1, 100);
    f.withdraw(1);
}

#[test]
fn deposit_lock_release_and_withdraw_conserve_tokens() {
    let f = Fixture::new();
    assert_eq!(f.deposit(300).available, 300);
    let locked = f.margin(1, 240);
    assert_eq!((locked.available, locked.locked), (60, 240));
    let released = f.margin(2, 80);
    assert_eq!((released.available, released.locked), (220, 80));
    let withdrawn = f.withdraw(220);
    assert_eq!((withdrawn.available, withdrawn.locked), (0, 80));
    f.margin(3, 0);
    assert_eq!(f.withdraw(80).available, 0);
}

#[test]
fn rejects_invalid_amounts_cap_stale_epoch_and_overwithdraw_atomically() {
    let f = Fixture::new();
    f.deposit(300);
    f.margin(1, 240);
    let before = f.client().get_state();
    for amount in [0, -1, i128::MIN] {
        f.auth(&f.fund, "deposit", (amount,).into_val(&f.env), None);
        error_code(f.client().try_deposit(&amount), Error::InvalidAmount);
        f.auth(&f.fund, "withdraw", (amount,).into_val(&f.env), None);
        error_code(f.client().try_withdraw(&amount), Error::InvalidAmount);
    }
    f.auth(&f.fund, "withdraw", (61i128,).into_val(&f.env), None);
    error_code(f.client().try_withdraw(&61), Error::InsufficientAvailable);
    for epoch in [0, 1] {
        f.auth(
            &f.keeper,
            "post_margin",
            (epoch, 100i128).into_val(&f.env),
            None,
        );
        error_code(f.client().try_post_margin(&epoch, &100), Error::StaleEpoch);
    }
    f.auth(
        &f.keeper,
        "post_margin",
        (2u64, -1i128).into_val(&f.env),
        None,
    );
    error_code(f.client().try_post_margin(&2, &-1), Error::InvalidAmount);
    f.auth(
        &f.keeper,
        "post_margin",
        (2u64, 10_001i128).into_val(&f.env),
        None,
    );
    error_code(f.client().try_post_margin(&2, &10_001), Error::AboveCap);
    assert_eq!(f.client().get_state(), before);
    f.assert_balance(0);
}

#[test]
fn deadline_is_not_extended_and_late_cure_is_allowed() {
    let f = Fixture::new();
    f.deposit(300);
    let call = f.margin(1, 400);
    assert_eq!(
        (call.status, call.shortfall, call.call_deadline),
        (Status::MarginCall, 100, 1_090)
    );
    f.env.ledger().with_mut(|l| l.timestamp = 1_030);
    assert_eq!(f.margin(2, 450).call_deadline, 1_090);
    assert_eq!(f.deposit(50).call_deadline, 1_090);
    f.env.ledger().with_mut(|l| l.timestamp = 1_091);
    let cured = f.deposit(100);
    assert_eq!(
        (cured.status, cured.shortfall, cured.call_deadline),
        (Status::Active, 0, 0)
    );
    assert_eq!(f.margin(3, 500).call_deadline, 1_181);
    let released = f.margin(4, 0);
    assert_eq!(
        (released.status, released.call_deadline, released.available),
        (Status::Active, 0, 450)
    );
}

#[test]
fn direct_sac_transfer_is_not_credited_or_withdrawable() {
    let f = Fixture::new();
    f.deposit(300);
    f.env.mock_all_auths();
    token::Client::new(&f.env, &f.asset).transfer(&f.fund, &f.vault, &50);
    f.auth(
        &f.keeper,
        "post_margin",
        (1u64, 320i128).into_val(&f.env),
        None,
    );
    let state = f.client().post_margin(&1, &320);
    assert_eq!(
        (state.locked, state.available, state.shortfall),
        (300, 0, 20)
    );
    f.assert_balance(50);
    f.auth(
        &f.keeper,
        "post_margin",
        (2u64, 0i128).into_val(&f.env),
        None,
    );
    f.client().post_margin(&2, &0);
    f.auth(&f.fund, "withdraw", (300i128,).into_val(&f.env), None);
    f.client().withdraw(&300);
    f.auth(&f.fund, "withdraw", (1i128,).into_val(&f.env), None);
    error_code(f.client().try_withdraw(&1), Error::InsufficientAvailable);
    f.assert_balance(50);
}

#[test]
fn failed_token_transfer_rolls_back_state() {
    let f = Fixture::new();
    let before = f.client().get_state();
    f.auth(
        &f.fund,
        "deposit",
        (100_001i128,).into_val(&f.env),
        Some(100_001),
    );
    assert!(f.client().try_deposit(&100_001).is_err());
    assert_eq!(f.client().get_state(), before);
    f.assert_balance(0);
}

#[test]
fn event_names_and_named_payloads_match_specification() {
    let f = Fixture::new();
    f.deposit(300);
    f.event(
        "deposited",
        Map::from_array(
            &f.env,
            [(Symbol::new(&f.env, "amount"), 300i128.into_val(&f.env))],
        ),
    );
    f.margin(1, 400);
    f.event(
        "margin_set",
        Map::from_array(
            &f.env,
            [
                (Symbol::new(&f.env, "epoch"), 1u64.into_val(&f.env)),
                (Symbol::new(&f.env, "required"), 400i128.into_val(&f.env)),
                (Symbol::new(&f.env, "locked"), 300i128.into_val(&f.env)),
                (Symbol::new(&f.env, "shortfall"), 100i128.into_val(&f.env)),
            ],
        ),
    );
    f.event(
        "margin_call",
        Map::from_array(
            &f.env,
            [(
                Symbol::new(&f.env, "call_deadline"),
                1_090u64.into_val(&f.env),
            )],
        ),
    );
    f.deposit(150);
    f.event("cured", Map::new(&f.env));
    f.withdraw(50);
    f.event(
        "withdrawn",
        Map::from_array(
            &f.env,
            [(Symbol::new(&f.env, "amount"), 50i128.into_val(&f.env))],
        ),
    );
}

#[test]
fn deposit_requires_authorization_for_the_nested_token_transfer() {
    let f = Fixture::new();
    let before = f.client().get_state();
    f.auth(&f.fund, "deposit", (100i128,).into_val(&f.env), None);
    auth_error(f.client().try_deposit(&100));
    assert_eq!(f.client().get_state(), before);
    f.assert_balance(0);
    // The exact same root authorization succeeds with its transfer child.
    f.deposit(100);
}

#[test]
fn deadline_overflow_rolls_back_margin_and_deposit() {
    let f = Fixture::new();
    f.deposit(100);
    let before = f.client().get_state();
    f.env.ledger().with_mut(|l| l.timestamp = u64::MAX - 89);
    f.auth(
        &f.keeper,
        "post_margin",
        (1u64, 101i128).into_val(&f.env),
        None,
    );
    assert!(f.client().try_post_margin(&1, &101).is_err());
    assert_eq!(f.client().get_state(), before);
    f.assert_balance(0);

    // An overflowing deposit must fail before any token movement.
    f.auth(
        &f.fund,
        "deposit",
        (i128::MAX,).into_val(&f.env),
        Some(i128::MAX),
    );
    assert!(f.client().try_deposit(&i128::MAX).is_err());
    assert_eq!(f.client().get_state(), before);
    f.assert_balance(0);
}

#[test]
fn margin_at_cap_is_accepted_and_refreshes_instance_ttl() {
    let f = Fixture::new();
    let ttl = || {
        f.env
            .as_contract(&f.vault, || f.env.storage().instance().get_ttl())
    };
    assert!(ttl() >= TTL_EXTEND_TO);
    let advance = ttl() - TTL_THRESHOLD + 1;
    f.env.ledger().with_mut(|l| l.sequence_number += advance);
    assert!(ttl() < TTL_THRESHOLD);
    let before_read = ttl();
    f.client().get_state();
    assert_eq!(ttl(), before_read, "get_state is read-only");
    f.auth(
        &f.keeper,
        "post_margin",
        (1u64, 10_000i128).into_val(&f.env),
        None,
    );
    let state = f.client().post_margin(&1, &10_000);
    assert_eq!((state.required, state.shortfall), (10_000, 10_000));
    assert_eq!(state.status, Status::MarginCall);
    assert!(ttl() >= TTL_EXTEND_TO);
}

#[test]
fn settlement_rejects_active_cured_and_premature_calls_without_changes() {
    let f = Fixture::new();
    f.deposit(300);
    let active = f.client().get_state();
    f.env.set_auths(&[]);
    error_code(f.client().try_settle_default(), Error::NotInMarginCall);
    assert_eq!(f.client().get_state(), active);
    f.assert_balance(0);

    let call = f.margin(1, 400);
    f.env
        .ledger()
        .with_mut(|l| l.timestamp = call.call_deadline - 1);
    f.env.set_auths(&[]);
    error_code(f.client().try_settle_default(), Error::GracePeriodRunning);
    assert_eq!(f.client().get_state(), call);
    f.assert_balance(0);

    let cured = f.deposit(100);
    f.env
        .ledger()
        .with_mut(|l| l.timestamp = call.call_deadline + 1);
    f.env.set_auths(&[]);
    error_code(f.client().try_settle_default(), Error::NotInMarginCall);
    assert_eq!(f.client().get_state(), cured);
    f.assert_balance(0);
}

#[test]
fn settlement_at_deadline_is_permissionless_exact_and_terminal() {
    let f = Fixture::new();
    f.deposit(300);
    let call = f.margin(7, 400);
    let fund_before = token::Client::new(&f.env, &f.asset).balance(&f.fund);
    f.env
        .ledger()
        .with_mut(|l| l.timestamp = call.call_deadline);
    let settled = f.settle(0);
    assert_eq!(
        settled,
        VaultState {
            locked: 0,
            required: 0,
            shortfall: 0,
            call_deadline: 0,
            status: Status::Defaulted,
            ..call
        }
    );
    let token = token::Client::new(&f.env, &f.asset);
    assert_eq!(token.balance(&f.bank), 300);
    assert_eq!(token.balance(&f.fund), fund_before);
    assert_eq!(token.balance(&f.vault), 0);
    assert_eq!(token.balance(&f.keeper), 0);
    f.event(
        "defaulted",
        Map::from_array(
            &f.env,
            [(Symbol::new(&f.env, "amount"), 300i128.into_val(&f.env))],
        ),
    );

    // Replaying settlement cannot transfer the collateral twice.
    f.env.set_auths(&[]);
    error_code(f.client().try_settle_default(), Error::NotInMarginCall);
    f.auth(&f.fund, "deposit", (1i128,).into_val(&f.env), Some(1));
    error_code(f.client().try_deposit(&1), Error::Defaulted);
    f.auth(
        &f.keeper,
        "post_margin",
        (8u64, 0i128).into_val(&f.env),
        None,
    );
    error_code(f.client().try_post_margin(&8, &0), Error::Defaulted);
    f.auth(&f.fund, "withdraw", (1i128,).into_val(&f.env), None);
    error_code(f.client().try_withdraw(&1), Error::InsufficientAvailable);
    assert_eq!(f.client().get_state(), settled);
    assert_eq!(token.balance(&f.bank), 300);
    f.assert_balance(0);
}

#[test]
fn settlement_excludes_unsolicited_surplus() {
    let f = Fixture::new();
    f.deposit(300);
    f.env.mock_all_auths();
    token::Client::new(&f.env, &f.asset).transfer(&f.fund, &f.vault, &50);
    f.auth(
        &f.keeper,
        "post_margin",
        (1u64, 400i128).into_val(&f.env),
        None,
    );
    let call = f.client().post_margin(&1, &400);
    f.assert_balance(50);
    f.env
        .ledger()
        .with_mut(|l| l.timestamp = call.call_deadline + 1);
    f.settle(50);
    assert_eq!(token::Client::new(&f.env, &f.asset).balance(&f.bank), 300);
    f.auth(&f.fund, "withdraw", (1i128,).into_val(&f.env), None);
    error_code(f.client().try_withdraw(&1), Error::InsufficientAvailable);
    f.assert_balance(50);
}

#[test]
fn no_shortfall_guard_rejects_a_synthetic_inconsistent_margin_call() {
    let f = Fixture::new();
    f.deposit(300);
    // A cured vault is normally Active. Inject an inconsistent state solely to
    // test the defensive NoShortfall guard, not as a reachable user flow.
    f.env.as_contract(&f.vault, || {
        let mut state = load(&f.env);
        state.status = Status::MarginCall;
        state.call_deadline = 1_000;
        save(&f.env, &state);
    });
    let before = f.client().get_state();
    f.env.set_auths(&[]);
    error_code(f.client().try_settle_default(), Error::NoShortfall);
    assert_eq!(f.client().get_state(), before);
    f.assert_balance(0);
}

#[test]
fn settlement_with_no_collateral_can_finalize_a_positive_shortfall() {
    let f = Fixture::new();
    let call = f.margin(1, 100);
    f.env
        .ledger()
        .with_mut(|l| l.timestamp = call.call_deadline);
    let state = f.settle(0);
    assert_eq!(state.status, Status::Defaulted);
    assert_eq!(state.epoch, 1);
    f.event(
        "defaulted",
        Map::from_array(
            &f.env,
            [(Symbol::new(&f.env, "amount"), 0i128.into_val(&f.env))],
        ),
    );
}

#[test]
fn settlement_preserves_synthetic_available_and_terminal_withdraw_does_not_relock() {
    let f = Fixture::new();
    f.deposit(300);
    // In normal rebalancing, shortfall > 0 implies available = 0. This
    // deliberately constructed state tests preservation of both independent
    // fields and the terminal withdrawal branch with nonzero available.
    f.env.as_contract(&f.vault, || {
        let mut state = load(&f.env);
        state.available = 50;
        state.locked = 250;
        state.required = 400;
        state.shortfall = 150;
        state.epoch = 9;
        state.status = Status::MarginCall;
        state.call_deadline = 1_000;
        save(&f.env, &state);
    });
    let state = f.settle(0);
    assert_eq!((state.available, state.epoch), (50, 9));
    assert_eq!(token::Client::new(&f.env, &f.asset).balance(&f.bank), 250);
    let state = f.withdraw(50);
    assert_eq!((state.available, state.locked, state.required), (0, 0, 0));
    assert_eq!(state.status, Status::Defaulted);
    assert_eq!(state.epoch, 9);
}

#[test]
fn rejected_bank_transfer_leaves_margin_call_and_collateral_unchanged() {
    let f = Fixture::new();
    f.deposit(300);
    let call = f.margin(1, 400);
    // Model a SAC recipient authorization failure; no successful settlement
    // or terminal state may be recorded when the token transfer is rejected.
    f.issuer
        .set_flag(soroban_sdk::testutils::IssuerFlags::RevocableFlag);
    f.env.mock_all_auths();
    token::StellarAssetClient::new(&f.env, &f.asset).set_authorized(&f.bank, &false);
    f.env
        .ledger()
        .with_mut(|l| l.timestamp = call.call_deadline);
    f.env.set_auths(&[]);
    assert!(f.client().try_settle_default().is_err());
    assert_eq!(f.client().get_state(), call);
    f.assert_balance(0);

    f.env.mock_all_auths();
    token::StellarAssetClient::new(&f.env, &f.asset).set_authorized(&f.bank, &true);
    f.settle(0);
    assert_eq!(token::Client::new(&f.env, &f.asset).balance(&f.bank), 300);
}
