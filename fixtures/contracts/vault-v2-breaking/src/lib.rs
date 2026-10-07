#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, BytesN, Env};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Position {
    pub owner: Address,
    pub amount: i128,
    pub unlock_at: u64,
    pub fee: i128,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Status {
    Open = 0,
    Paused = 1,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Action {
    Deposit(i128),
    Withdraw(i128),
    Close,
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum VaultError {
    NotFound = 10,
    Insufficient = 2,
    Paused = 3,
}

#[contracttype]
enum Key {
    Admin,
    Status,
    Position(Address),
    LastAction(Address),
}

#[contract]
pub struct Vault;

#[contractimpl]
impl Vault {
    pub fn __constructor(env: Env, admin: Address) {
        env.storage().instance().set(&Key::Admin, &admin);
        env.storage().instance().set(&Key::Status, &Status::Open);
    }

    /// Deposit `amount` for `from`. Returns the new balance.
    pub fn deposit(env: Env, from: Address, amount: u64) -> Result<i128, VaultError> {
        from.require_auth();
        if Self::status(env.clone()) == Status::Paused {
            return Err(VaultError::Paused);
        }
        let mut p = Self::find(&env, from.clone()).unwrap_or(Position {
            owner: from.clone(),
            amount: 0,
            unlock_at: 0,
            fee: 0,
        });
        p.amount += amount as i128;
        env.storage().persistent().set(&Key::Position(from.clone()), &p);
        env.storage().persistent().set(&Key::LastAction(from), &Action::Deposit(amount as i128));
        Ok(p.amount)
    }

    /// Withdraw `amount` to `to`. Returns the remaining balance.
    pub fn withdraw(env: Env, to: Address, amount: i128) -> Result<i128, VaultError> {
        to.require_auth();
        let mut p = Self::find(&env, to.clone()).ok_or(VaultError::NotFound)?;
        if p.amount < amount {
            return Err(VaultError::Insufficient);
        }
        p.amount -= amount;
        env.storage().persistent().set(&Key::Position(to.clone()), &p);
        env.storage().persistent().set(&Key::LastAction(to), &Action::Withdraw(amount));
        Ok(p.amount)
    }

    pub fn position(env: Env, owner: Address) -> Position {
        Self::find(&env, owner).unwrap_or_else(|| panic!("no position"))
    }

    pub fn status(env: Env) -> Status {
        env.storage().instance().get(&Key::Status).unwrap_or(Status::Open)
    }

    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        let admin: Address = env.storage().instance().get(&Key::Admin).unwrap();
        admin.require_auth();
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }
}

impl Vault {
    fn find(env: &Env, owner: Address) -> Option<Position> {
        env.storage().persistent().get(&Key::Position(owner))
    }
}
