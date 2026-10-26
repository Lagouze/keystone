#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error,
    symbol_short, token, Address, Env,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Status {
    Active,
    MarginCall,
    Defaulted,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VaultState {
    pub fund: Address,
    pub bank: Address,
    pub keeper: Address,
    pub asset: Address,
    pub available: i128,
    pub locked: i128,
    pub required: i128,
    pub shortfall: i128,
    pub status: Status,
    pub epoch: u64,
    pub call_deadline: u64,
    pub grace_period_secs: u64,
    pub max_required: i128,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    InvalidAmount = 1,
    InsufficientAvailable = 2,
    StaleEpoch = 3,
    AboveCap = 4,
    NotInMarginCall = 5,
    GracePeriodRunning = 6,
    NoShortfall = 7,
    Defaulted = 8,
}

#[contractevent(topics = ["deposited"])]
pub struct Deposited {
    pub amount: i128,
}

#[contractevent(topics = ["withdrawn"])]
pub struct Withdrawn {
    pub amount: i128,
}

#[contractevent(topics = ["margin_set"])]
pub struct MarginSet {
    pub epoch: u64,
    pub required: i128,
    pub locked: i128,
    pub shortfall: i128,
}

#[contractevent(topics = ["margin_call"])]
pub struct MarginCall {
    pub call_deadline: u64,
}

#[contractevent(topics = ["cured"])]
pub struct Cured {}

#[contractevent(topics = ["defaulted"])]
pub struct Defaulted {
    pub amount: i128,
}

#[contract]
pub struct KeystoneVault;

const TTL_THRESHOLD: u32 = 17_280;
const TTL_EXTEND_TO: u32 = 518_400;

fn load(env: &Env) -> VaultState {
    env.storage()
        .instance()
        .get(&symbol_short!("state"))
        .expect("vault must be constructed")
}

fn save(env: &Env, state: &VaultState) {
    env.storage().instance().set(&symbol_short!("state"), state);
    env.storage()
        .instance()
        .extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
}

fn active_required(env: &Env, state: &VaultState) {
    if state.status == Status::Defaulted {
        panic_with_error!(env, Error::Defaulted);
    }
}

fn positive_amount(env: &Env, amount: i128) {
    if amount <= 0 {
        panic_with_error!(env, Error::InvalidAmount);
    }
}

fn rebalance(env: &Env, state: &mut VaultState) {
    // Terminal vaults must never re-lock a remaining available balance.
    if state.status == Status::Defaulted {
        return;
    }
    let total = state
        .available
        .checked_add(state.locked)
        .expect("balance overflow");
    state.locked = core::cmp::min(state.required, total);
    state.available = total - state.locked;
    state.shortfall = state.required - state.locked;
    if state.shortfall > 0 && state.status == Status::Active {
        state.status = Status::MarginCall;
        state.call_deadline = env
            .ledger()
            .timestamp()
            .checked_add(state.grace_period_secs)
            .expect("deadline overflow");
        MarginCall {
            call_deadline: state.call_deadline,
        }
        .publish(env);
    } else if state.shortfall == 0 && state.status == Status::MarginCall {
        state.status = Status::Active;
        state.call_deadline = 0;
        Cured {}.publish(env);
    }
}

#[contractimpl]
impl KeystoneVault {
    pub fn __constructor(
        env: Env,
        fund: Address,
        bank: Address,
        keeper: Address,
        asset: Address,
        max_required: i128,
        grace_period_secs: u64,
    ) {
        if max_required < 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        let state = VaultState {
            fund,
            bank,
            keeper,
            asset,
            available: 0,
            locked: 0,
            required: 0,
            shortfall: 0,
            status: Status::Active,
            epoch: 0,
            call_deadline: 0,
            grace_period_secs,
            max_required,
        };
        save(&env, &state);
    }

    pub fn deposit(env: Env, amount: i128) -> VaultState {
        let mut state = load(&env);
        state.fund.require_auth();
        active_required(&env, &state);
        positive_amount(&env, amount);
        state.available = state
            .available
            .checked_add(amount)
            .expect("balance overflow");
        // Credit only this deposit, never an unsolicited SAC balance surplus.
        token::Client::new(&env, &state.asset).transfer(
            &state.fund,
            &env.current_contract_address(),
            &amount,
        );
        rebalance(&env, &mut state);
        save(&env, &state);
        Deposited { amount }.publish(&env);
        state
    }

    pub fn withdraw(env: Env, amount: i128) -> VaultState {
        let mut state = load(&env);
        state.fund.require_auth();
        positive_amount(&env, amount);
        if amount > state.available {
            panic_with_error!(&env, Error::InsufficientAvailable);
        }
        state.available -= amount;
        token::Client::new(&env, &state.asset).transfer(
            &env.current_contract_address(),
            &state.fund,
            &amount,
        );
        rebalance(&env, &mut state);
        save(&env, &state);
        Withdrawn { amount }.publish(&env);
        state
    }

    pub fn post_margin(env: Env, epoch: u64, required: i128) -> VaultState {
        let mut state = load(&env);
        state.keeper.require_auth();
        active_required(&env, &state);
        if required < 0 {
            panic_with_error!(&env, Error::InvalidAmount);
        }
        if epoch <= state.epoch {
            panic_with_error!(&env, Error::StaleEpoch);
        }
        if required > state.max_required {
            panic_with_error!(&env, Error::AboveCap);
        }
        state.epoch = epoch;
        state.required = required;
        rebalance(&env, &mut state);
        save(&env, &state);
        MarginSet {
            epoch,
            required,
            locked: state.locked,
            shortfall: state.shortfall,
        }
        .publish(&env);
        state
    }

    pub fn settle_default(env: Env) -> VaultState {
        let mut state = load(&env);
        // Permissionless trigger: the ledger and stored state decide eligibility.
        if state.status != Status::MarginCall {
            panic_with_error!(&env, Error::NotInMarginCall);
        }
        if env.ledger().timestamp() < state.call_deadline {
            panic_with_error!(&env, Error::GracePeriodRunning);
        }
        if state.shortfall <= 0 {
            panic_with_error!(&env, Error::NoShortfall);
        }
        let amount = state.locked;
        token::Client::new(&env, &state.asset).transfer(
            &env.current_contract_address(),
            &state.bank,
            &amount,
        );
        state.locked = 0;
        state.required = 0;
        state.shortfall = 0;
        state.call_deadline = 0;
        state.status = Status::Defaulted;
        // Preserve available and epoch; never rebalance a terminal vault.
        save(&env, &state);
        Defaulted { amount }.publish(&env);
        state
    }

    pub fn get_state(env: Env) -> VaultState {
        load(&env)
    }
}

#[cfg(test)]
extern crate std;
#[cfg(test)]
mod test;
