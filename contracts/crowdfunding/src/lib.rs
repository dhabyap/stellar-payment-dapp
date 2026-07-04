#![no_std]
use soroban_sdk::{contract, contractimpl, symbol_short, Env, Symbol, Address, Vec};

const OWNER: Symbol = symbol_short!("owner");
const TITLE: Symbol = symbol_short!("title");
const TARGET: Symbol = symbol_short!("target");
const RAISED: Symbol = symbol_short!("raised");
const DEADLINE: Symbol = symbol_short!("deadline");
const ACTIVE: Symbol = symbol_short!("active");

#[contract]
pub struct Crowdfunding;

#[contractimpl]
impl Crowdfunding {
    pub fn create(env: Env, owner: Address, title: Symbol, target: i128, deadline: u64) {
        owner.require_auth();
        if target <= 0 {
            panic!("target must be > 0")
        }
        if deadline <= env.ledger().timestamp() {
            panic!("deadline must be in future")
        }
        env.storage().persistent().set(&OWNER, &owner);
        env.storage().persistent().set(&TITLE, &title);
        env.storage().persistent().set(&TARGET, &target);
        env.storage().persistent().set(&RAISED, &0i128);
        env.storage().persistent().set(&DEADLINE, &deadline);
        env.storage().persistent().set(&ACTIVE, &true);
    }

    pub fn donate(env: Env, donor: Address, amount: i128) {
        donor.require_auth();
        if amount <= 0 {
            panic!("amount must be > 0")
        }
        let active: bool = env.storage().persistent().get(&ACTIVE).unwrap();
        if !active {
            panic!("campaign ended")
        }
        let deadline: u64 = env.storage().persistent().get(&DEADLINE).unwrap();
        if env.ledger().timestamp() >= deadline {
            panic!("deadline passed")
        }
        let raised: i128 = env.storage().persistent().get(&RAISED).unwrap();
        env.storage().persistent().set(&RAISED, &(raised + amount));
    }

    pub fn claim(env: Env) {
        let active: bool = env.storage().persistent().get(&ACTIVE).unwrap();
        if !active {
            panic!("already claimed")
        }
        let owner: Address = env.storage().persistent().get(&OWNER).unwrap();
        owner.require_auth();
        let now = env.ledger().timestamp();
        let deadline: u64 = env.storage().persistent().get(&DEADLINE).unwrap();
        let raised: i128 = env.storage().persistent().get(&RAISED).unwrap();
        let target: i128 = env.storage().persistent().get(&TARGET).unwrap();
        if now < deadline && raised < target {
            panic!("conditions not met")
        }
        env.storage().persistent().set(&ACTIVE, &false);
    }

    pub fn get(env: Env) -> Vec<i128> {
        let owner: Address = env.storage().persistent().get(&OWNER).unwrap();
        let target: i128 = env.storage().persistent().get(&TARGET).unwrap();
        let raised: i128 = env.storage().persistent().get(&RAISED).unwrap();
        let deadline: u64 = env.storage().persistent().get(&DEADLINE).unwrap();
        let active: bool = env.storage().persistent().get(&ACTIVE).unwrap();
        Vec::from_array(&env, [
            target,
            raised,
            deadline as i128,
            if active { 1i128 } else { 0i128 },
        ])
    }
}
