use soroban_sdk::{
    Address, Env, Map, Symbol, contract, contractimpl,
    token::Client as TokenClient,
};
use crate::types::{self, Stream};
use crate::storage::{
    streams_map, set_streams_map, get_next_stream_id, set_next_stream_id,
    get_admin, set_admin, is_paused, set_paused,
};

#[contract]
pub struct Loomstream;

#[contractimpl]
impl Loomstream {
    pub fn initialize(env: Env, admin: Address) {
        admin.require_auth();
        set_admin(&env, &admin);
        set_paused(&env, false);
        set_next_stream_id(&env, 1);
    }

    pub fn create_stream(
        env: Env,
        sender: Address,
        recipient: Address,
        token: Address,
        deposit: i128,
        start_time: u64,
        end_time: u64,
        cliff_time: u64,
        cancelable: bool,
    ) -> u64 {
        sender.require_auth();

        if is_paused(&env) {
            panic!("Contract is paused");
        }

        if deposit <= 0 {
            panic!("Deposit must be greater than zero");
        }

        if end_time <= start_time {
            panic!("End time must be after start time");
        }

        if end_time - start_time < types::MIN_STREAM_DURATION_SECS {
            panic!(
                "Stream duration must be at least {} seconds",
                types::MIN_STREAM_DURATION_SECS
            );
        }

        if cliff_time < start_time || cliff_time > end_time {
            panic!("Cliff time must be within [start_time, end_time]");
        }

        let stream_id = get_next_stream_id(&env);
        set_next_stream_id(&env, stream_id + 1);

        let token_client = TokenClient::new(&env, &token);
        let contract_address = env.current_contract_address();
        token_client.transfer_from(&sender, &sender, &contract_address, &deposit);

        let stream = Stream {
            sender: sender.clone(),
            recipient: recipient.clone(),
            token: token.clone(),
            deposit,
            start_time,
            end_time,
            cliff_time,
            cancelable,
            canceled: false,
            withdrawn_amount: 0,
        };

        let mut streams = streams_map(&env);
        streams.set(stream_id, stream.clone());
        set_streams_map(&env, &streams);

        env.events().publish(
            (
                Symbol::new(&env, "StreamCreated"),
                stream_id,
                sender.clone(),
                recipient.clone(),
                token.clone(),
            ),
            (deposit, start_time, end_time, cliff_time, cancelable),
        );

        stream_id
    }

    pub fn withdraw(env: Env, stream_id: u64, caller: Address, amount: i128) {
        caller.require_auth();

        let mut streams = streams_map(&env);
        let stream: Stream = streams
            .get(stream_id)
            .expect("Stream not found");

        if stream.canceled {
            panic!("Stream is canceled");
        }

        let current_time = env.ledger().timestamp();
        if current_time < stream.start_time {
            panic!("Stream has not started yet");
        }

        let vested = types::compute_vested_amount(
            stream.deposit,
            stream.start_time,
            stream.end_time,
            stream.cliff_time,
            current_time,
        );
        let available = vested - stream.withdrawn_amount;

        if amount <= 0 {
            panic!("Amount must be greater than zero");
        }

        if amount > available {
            panic!("Amount exceeds withdrawable balance");
        }

        let contract_address = env.current_contract_address();
        let token_client = TokenClient::new(&env, &stream.token);
        token_client.transfer(&contract_address, &stream.recipient, &amount);

        let new_withdrawn = stream.withdrawn_amount + amount;
        let mut updated_stream = stream.clone();
        updated_stream.withdrawn_amount = new_withdrawn;
        streams.set(stream_id, updated_stream.clone());
        set_streams_map(&env, &streams);

        env.events().publish(
            (
                Symbol::new(&env, "StreamWithdraw"),
                stream_id,
                caller.clone(),
                stream.recipient.clone(),
            ),
            (amount,),
        );
    }

    pub fn cancel(env: Env, stream_id: u64, caller: Address) {
        caller.require_auth();

        let mut streams = streams_map(&env);
        let stream: Stream = streams
            .get(stream_id)
            .expect("Stream not found");

        if stream.canceled {
            panic!("Stream is already canceled");
        }

        if !stream.cancelable {
            panic!("Stream is not cancelable");
        }

        if caller != stream.sender {
            panic!("Only the sender can cancel this stream");
        }

        let current_time = env.ledger().timestamp();
        let vested = types::compute_vested_amount(
            stream.deposit,
            stream.start_time,
            stream.end_time,
            stream.cliff_time,
            current_time,
        );
        let withdrawn = stream.withdrawn_amount;
        let vested_unwithdrawn = vested - withdrawn;
        let unvested = stream.deposit - vested;

        let contract_address = env.current_contract_address();
        let token_client = TokenClient::new(&env, &stream.token);

        if vested_unwithdrawn > 0 {
            token_client.transfer(&contract_address, &stream.recipient, &vested_unwithdrawn);
        }

        if unvested > 0 {
            token_client.transfer(&contract_address, &stream.sender, &unvested);
        }

        let mut updated_stream = stream.clone();
        updated_stream.canceled = true;
        streams.set(stream_id, updated_stream.clone());
        set_streams_map(&env, &streams);

        env.events().publish(
            (
                Symbol::new(&env, "StreamCanceled"),
                stream_id,
                stream.sender.clone(),
                stream.recipient.clone(),
            ),
            (vested_unwithdrawn, unvested),
        );
    }

    pub fn get_stream(env: Env, stream_id: u64) -> Stream {
        let streams = streams_map(&env);
        streams
            .get(stream_id)
            .expect("Stream not found")
    }

    pub fn withdrawable_amount(env: Env, stream_id: u64) -> i128 {
        let streams = streams_map(&env);
        let stream: Stream = streams
            .get(stream_id)
            .expect("Stream not found");
        types::compute_withdrawable(
            stream.deposit,
            stream.start_time,
            stream.end_time,
            stream.cliff_time,
            stream.withdrawn_amount,
            &env,
        )
    }

    pub fn set_paused(env: Env, paused: bool) {
        let admin = get_admin(&env);
        admin.require_auth();
        set_paused(&env, paused);
    }

    pub fn set_admin(env: Env, new_admin: Address) {
        let admin = get_admin(&env);
        admin.require_auth();
        new_admin.require_auth();
        set_admin(&env, &new_admin);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger as _, Map as _, Symbol as _, Token as _, Env as _},
        Address, Env, Map, Symbol,
    };

    fn create_test_env() -> (Env, Address, Address, Address, Address) {
        let env = Env::default();
        let admin = Address::generate(&env);
        let sender = Address::generate(&env);
        let recipient = Address::generate(&env);
        let token = Address::generate(&env);

        env.mock.all_tokens().add(&token, &admin);

        (env, admin, sender, recipient, token)
    }

    #[test]
    fn test_initialize() {
        let (env, admin, _, _, _) = create_test_env();

        Loomstream::initialize(env.clone(), admin.clone());

        assert_eq!(get_admin(&env), admin);
        assert!(!is_paused(&env));
        assert_eq!(get_next_stream_id(&env), 1);
    }

    #[test]
    #[should_panic(expected = "Admin not set")]
    fn test_initialize_without_admin() {
        let env = Env::default();
        let admin = Address::generate(&env);
        admin.require_auth();
        Loomstream::initialize(env, admin);
    }

    #[test]
    fn test_create_stream() {
        let (env, admin, sender, recipient, token) = create_test_env();
        Loomstream::initialize(env.clone(), admin.clone());

        let start_time = env.ledger().timestamp() + 100;
        let end_time = start_time + 86400;
        let cliff_time = start_time + 3600;
        let deposit = 1000i128;

        let stream_id = Loomstream::create_stream(
            env.clone(),
            sender.clone(),
            recipient.clone(),
            token.clone(),
            deposit,
            start_time,
            end_time,
            cliff_time,
            true,
        );

        assert_eq!(stream_id, 1);
        assert_eq!(get_next_stream_id(&env), 2);

        let stream = get_stream(env.clone(), stream_id);
        assert_eq!(stream.sender, sender);
        assert_eq!(stream.recipient, recipient);
        assert_eq!(stream.token, token);
        assert_eq!(stream.deposit, deposit);
        assert_eq!(stream.start_time, start_time);
        assert_eq!(stream.end_time, end_time);
        assert_eq!(stream.cliff_time, cliff_time);
        assert!(stream.cancelable);
        assert!(!stream.canceled);
        assert_eq!(stream.withdrawn_amount, 0);
    }

    #[test]
    #[should_panic(expected = "Deposit must be greater than zero")]
    fn test_create_stream_zero_deposit() {
        let (env, admin, sender, recipient, token) = create_test_env();
        Loomstream::initialize(env.clone(), admin.clone());

        let start_time = env.ledger().timestamp() + 100;
        let end_time = start_time + 86400;
        let cliff_time = start_time + 3600;

        Loomstream::create_stream(
            env,
            sender,
            recipient,
            token,
            0,
            start_time,
            end_time,
            cliff_time,
            true,
        );
    }

    #[test]
    #[should_panic(expected = "End time must be after start time")]
    fn test_create_stream_end_before_start() {
        let (env, admin, sender, recipient, token) = create_test_env();
        Loomstream::initialize(env.clone(), admin.clone());

        let start_time = env.ledger().timestamp() + 100;
        let end_time = start_time - 100;
        let cliff_time = start_time;

        Loomstream::create_stream(
            env,
            sender,
            recipient,
            token,
            1000,
            start_time,
            end_time,
            cliff_time,
            true,
        );
    }

    #[test]
    #[should_panic(expected = "Stream duration must be at least 60 seconds")]
    fn test_create_stream_too_short() {
        let (env, admin, sender, recipient, token) = create_test_env();
        Loomstream::initialize(env.clone(), admin.clone());

        let start_time = env.ledger().timestamp() + 100;
        let end_time = start_time + 30;
        let cliff_time = start_time;

        Loomstream::create_stream(
            env,
            sender,
            recipient,
            token,
            1000,
            start_time,
            end_time,
            cliff_time,
            true,
        );
    }

    #[test]
    fn test_withdraw() {
        let (env, admin, sender, recipient, token) = create_test_env();
        Loomstream::initialize(env.clone(), admin.clone());

        let start_time = env.ledger().timestamp() + 100;
        let end_time = start_time + 86400;
        let cliff_time = start_time;
        let deposit = 1000i128;

        let stream_id = Loomstream::create_stream(
            env.clone(),
            sender.clone(),
            recipient.clone(),
            token.clone(),
            deposit,
            start_time,
            end_time,
            cliff_time,
            true,
        );

        env.ledger().set_timestamp(start_time + 43200);

        Loomstream::withdraw(env.clone(), stream_id, recipient.clone(), 500);

        let stream = get_stream(env.clone(), stream_id);
        assert_eq!(stream.withdrawn_amount, 500);
    }

    #[test]
    #[should_panic(expected = "Amount exceeds withdrawable balance")]
    fn test_withdraw_too_much() {
        let (env, admin, sender, recipient, token) = create_test_env();
        Loomstream::initialize(env.clone(), admin.clone());

        let start_time = env.ledger().timestamp() + 100;
        let end_time = start_time + 86400;
        let cliff_time = start_time;
        let deposit = 1000i128;

        let stream_id = Loomstream::create_stream(
            env.clone(),
            sender.clone(),
            recipient.clone(),
            token.clone(),
            deposit,
            start_time,
            end_time,
            cliff_time,
            true,
        );

        env.ledger().set_timestamp(start_time + 43200);

        Loomstream::withdraw(env.clone(), stream_id, recipient.clone(), 2000);
    }

    #[test]
    #[should_panic(expected = "Stream has not started yet")]
    fn test_withdraw_before_start() {
        let (env, admin, sender, recipient, token) = create_test_env();
        Loomstream::initialize(env.clone(), admin.clone());

        let start_time = env.ledger().timestamp() + 100;
        let end_time = start_time + 86400;
        let cliff_time = start_time;
        let deposit = 1000i128;

        let stream_id = Loomstream::create_stream(
            env.clone(),
            sender.clone(),
            recipient.clone(),
            token.clone(),
            deposit,
            start_time,
            end_time,
            cliff_time,
            true,
        );

        Loomstream::withdraw(env.clone(), stream_id, recipient.clone(), 100);
    }

    #[test]
    fn test_cancel() {
        let (env, admin, sender, recipient, token) = create_test_env();
        Loomstream::initialize(env.clone(), admin.clone());

        let start_time = env.ledger().timestamp() + 100;
        let end_time = start_time + 86400;
        let cliff_time = start_time;
        let deposit = 1000i128;

        let stream_id = Loomstream::create_stream(
            env.clone(),
            sender.clone(),
            recipient.clone(),
            token.clone(),
            deposit,
            start_time,
            end_time,
            cliff_time,
            true,
        );

        env.ledger().set_timestamp(start_time + 43200);

        Loomstream::cancel(env.clone(), stream_id, sender.clone());

        let stream = get_stream(env.clone(), stream_id);
        assert!(stream.canceled);
    }

    #[test]
    #[should_panic(expected = "Stream is not cancelable")]
    fn test_cancel_non_cancelable() {
        let (env, admin, sender, recipient, token) = create_test_env();
        Loomstream::initialize(env.clone(), admin.clone());

        let start_time = env.ledger().timestamp() + 100;
        let end_time = start_time + 86400;
        let cliff_time = start_time;
        let deposit = 1000i128;

        let stream_id = Loomstream::create_stream(
            env.clone(),
            sender.clone(),
            recipient.clone(),
            token.clone(),
            deposit,
            start_time,
            end_time,
            cliff_time,
            false,
        );

        Loomstream::cancel(env.clone(), stream_id, sender.clone());
    }

    #[test]
    #[should_panic(expected = "Only the sender can cancel this stream")]
    fn test_cancel_wrong_sender() {
        let (env, admin, sender, recipient, token) = create_test_env();
        Loomstream::initialize(env.clone(), admin.clone());

        let start_time = env.ledger().timestamp() + 100;
        let end_time = start_time + 86400;
        let cliff_time = start_time;
        let deposit = 1000i128;

        let stream_id = Loomstream::create_stream(
            env.clone(),
            sender.clone(),
            recipient.clone(),
            token.clone(),
            deposit,
            start_time,
            end_time,
            cliff_time,
            true,
        );

        let other = Address::generate(&env);
        Loomstream::cancel(env.clone(), stream_id, other);
    }

    #[test]
    fn test_get_stream() {
        let (env, admin, sender, recipient, token) = create_test_env();
        Loomstream::initialize(env.clone(), admin.clone());

        let start_time = env.ledger().timestamp() + 100;
        let end_time = start_time + 86400;
        let cliff_time = start_time;
        let deposit = 1000i128;

        let stream_id = Loomstream::create_stream(
            env.clone(),
            sender.clone(),
            recipient.clone(),
            token.clone(),
            deposit,
            start_time,
            end_time,
            cliff_time,
            true,
        );

        let stream = get_stream(env.clone(), stream_id);
        assert_eq!(stream.stream_id, stream_id);
        assert_eq!(stream.sender, sender);
        assert_eq!(stream.recipient, recipient);
    }

    #[test]
    fn test_withdrawable_amount() {
        let (env, admin, sender, recipient, token) = create_test_env();
        Loomstream::initialize(env.clone(), admin.clone());

        let start_time = env.ledger().timestamp() + 100;
        let end_time = start_time + 86400;
        let cliff_time = start_time;
        let deposit = 1000i128;

        let stream_id = Loomstream::create_stream(
            env.clone(),
            sender.clone(),
            recipient.clone(),
            token.clone(),
            deposit,
            start_time,
            end_time,
            cliff_time,
            true,
        );

        env.ledger().set_timestamp(start_time + 43200);

        let withdrawable = Loomstream::withdrawable_amount(env.clone(), stream_id);
        assert_eq!(withdrawable, 500);
    }

    #[test]
    fn test_set_paused() {
        let (env, admin, _, _, _) = create_test_env();
        Loomstream::initialize(env.clone(), admin.clone());

        assert!(!is_paused(&env));

        Loomstream::set_paused(env.clone(), true);
        assert!(is_paused(&env));

        Loomstream::set_paused(env.clone(), false);
        assert!(!is_paused(&env));
    }

    #[test]
    #[should_panic(expected = "Contract is paused")]
    fn test_create_stream_when_paused() {
        let (env, admin, sender, recipient, token) = create_test_env();
        Loomstream::initialize(env.clone(), admin.clone());
        Loomstream::set_paused(env.clone(), true);

        let start_time = env.ledger().timestamp() + 100;
        let end_time = start_time + 86400;
        let cliff_time = start_time;

        Loomstream::create_stream(
            env,
            sender,
            recipient,
            token,
            1000,
            start_time,
            end_time,
            cliff_time,
            true,
        );
    }

    #[test]
    fn test_compute_vested_amount() {
        let env = Env::default();

        // Before start time
        assert_eq!(
            compute_vested_amount(1000, 1000, 2000, 1000, 500),
            0
        );

        // Before cliff time
        assert_eq!(
            compute_vested_amount(1000, 1000, 2000, 1500, 1200),
            0
        );

        // After cliff, before end (linear)
        assert_eq!(
            compute_vested_amount(1000, 1000, 2000, 1500, 1750),
            500
        );

        // After end
        assert_eq!(
            compute_vested_amount(1000, 1000, 2000, 1500, 3000),
            1000
        );

        // At cliff exactly
        assert_eq!(
            compute_vested_amount(1000, 1000, 2000, 1500, 1500),
            0
        );
    }

    #[test]
    fn test_compute_withdrawable() {
        let env = Env::default();

        // No withdrawals yet, halfway through
        let withdrawable = compute_withdrawable(1000, 1000, 2000, 1500, 0, &env);
        assert_eq!(withdrawable, 500);

        // After some withdrawals
        let withdrawable = compute_withdrawable(1000, 1000, 2000, 1500, 300, &env);
        assert_eq!(withdrawable, 200);

        // Fully withdrawn
        let withdrawable = compute_withdrawable(1000, 1000, 2000, 1500, 1000, &env);
        assert_eq!(withdrawable, 0);
    }

    #[test]
    fn test_set_admin() {
        let (env, admin, _, _, _) = create_test_env();
        Loomstream::initialize(env.clone(), admin.clone());

        let new_admin = Address::generate(&env);
        Loomstream::set_admin(env.clone(), new_admin.clone());

        assert_eq!(get_admin(&env), new_admin);
    }
}