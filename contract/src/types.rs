use soroban_sdk::{Address, Env, Map, Symbol, contracttype};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Stream {
    pub sender: Address,
    pub recipient: Address,
    pub token: Address,
    pub deposit: i128,
    pub start_time: u64,
    pub end_time: u64,
    pub cliff_time: u64,
    pub cancelable: bool,
    pub canceled: bool,
    pub withdrawn_amount: i128,
}

pub const MIN_STREAM_DURATION_SECS: u64 = 60;

pub fn compute_vested_amount(deposit: i128, start_time: u64, end_time: u64, cliff_time: u64, current_time: u64) -> i128 {
    if current_time < start_time || current_time < cliff_time {
        return 0;
    }
    if current_time >= end_time {
        return deposit;
    }
    let elapsed = current_time - cliff_time;
    let total = end_time - cliff_time;
    if total == 0 {
        return deposit;
    }
    (deposit * elapsed as i128) / total as i128
}

pub fn compute_withdrawable(
    deposit: i128,
    start_time: u64,
    end_time: u64,
    cliff_time: u64,
    withdrawn_amount: i128,
    env: &Env,
) -> i128 {
    let current_time = env.ledger().timestamp();
    let vested = compute_vested_amount(deposit, start_time, end_time, cliff_time, current_time);
    let remaining = vested - withdrawn_amount;
    if remaining < 0 {
        0
    } else {
        remaining
    }
}