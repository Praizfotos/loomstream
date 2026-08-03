use soroban_sdk::{Address, Env, Map, Symbol};
use crate::types;

pub fn streams_map(env: &Env) -> Map<u64, types::Stream> {
    let key = Symbol::new(env, "streams");
    let instance = env.storage().instance();
    match instance.get(&key) {
        Some(m) => m,
        None => Map::new(env),
    }
}

pub fn set_streams_map(env: &Env, maps: &Map<u64, types::Stream>) {
    let key = Symbol::new(env, "streams");
    let instance = env.storage().instance();
    instance.set(&key, maps);
}

pub fn get_next_stream_id(env: &Env) -> u64 {
    let key = Symbol::new(env, "next_stream_id");
    let instance = env.storage().instance();
    instance.get(&key).unwrap_or_default()
}

pub fn set_next_stream_id(env: &Env, id: u64) {
    let key = Symbol::new(env, "next_stream_id");
    let instance = env.storage().instance();
    instance.set(&key, &id);
}

pub fn get_admin(env: &Env) -> Address {
    let key = Symbol::new(env, "admin");
    let instance = env.storage().instance();
    instance.get(&key).expect("admin not set")
}

pub fn set_admin(env: &Env, admin: &Address) {
    let key = Symbol::new(env, "admin");
    let instance = env.storage().instance();
    instance.set(&key, admin);
}

pub fn is_paused(env: &Env) -> bool {
    let key = Symbol::new(env, "paused");
    let instance = env.storage().instance();
    instance.get(&key).unwrap_or_default()
}

pub fn set_paused(env: &Env, paused: bool) {
    let key = Symbol::new(env, "paused");
    let instance = env.storage().instance();
    instance.set(&key, &paused);
}