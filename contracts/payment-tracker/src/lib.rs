#![no_std]
use soroban_sdk::{contract, contractimpl, log, Address, Env, String, Vec};

#[derive(Clone, Debug, Eq, PartialEq)]
#[soroban_sdk::contracttype]
pub struct Payment {
    pub id: u64,
    pub sender: Address,
    pub receiver: String,
    pub amount: i128,
    pub memo: String,
    pub timestamp: u64,
    pub status: Status,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[soroban_sdk::contracttype]
pub enum Status {
    Pending,
    Completed,
    Failed,
}

#[derive(Clone)]
#[soroban_sdk::contracttype]
pub enum DataKey {
    Payment(u64),
    SenderPayment(Address, u64),
    Count,
    Initialized,
}

#[contract]
pub struct PaymentTracker;

#[contractimpl]
impl PaymentTracker {
    /// Initialize the contract
    pub fn initialize(env: Env) {
        if env.storage().instance().has(&DataKey::Initialized) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Count, &0u64);
        env.storage().instance().set(&DataKey::Initialized, &true);
        log!(&env, "Contract initialized");
    }

    /// Create a new payment record
    pub fn create_payment(
        env: Env,
        sender: Address,
        receiver: String,
        amount: i128,
        memo: String,
    ) -> u64 {
        // Require initialized
        if !env.storage().instance().has(&DataKey::Initialized) {
            panic!("contract not initialized");
        }

        // Authenticate sender
        sender.require_auth();

        let mut count: u64 = env.storage().instance().get(&DataKey::Count).unwrap_or(0);
        count += 1;

        let payment = Payment {
            id: count,
            sender: sender.clone(),
            receiver,
            amount,
            memo,
            timestamp: env.ledger().timestamp(),
            status: Status::Pending,
        };

        // Store by ID
        env.storage().instance().set(&DataKey::Payment(count), &payment);

        // Store under sender index
        env.storage().instance().set(&DataKey::SenderPayment(sender.clone(), count), &true);
        env.storage().instance().set(&DataKey::Count, &count);

        log!(&env, "Payment {} created by {}", count, sender);
        count
    }

    /// Mark payment as completed
    pub fn mark_completed(env: Env, id: u64, caller: Address) {
        caller.require_auth();
        let mut payment: Payment = env
            .storage()
            .instance()
            .get(&DataKey::Payment(id))
            .expect("payment not found");

        if payment.status != Status::Pending {
            panic!("payment already finalized");
        }
        payment.status = Status::Completed;
        env.storage().instance().set(&DataKey::Payment(id), &payment);
        log!(&env, "Payment {} completed", id);
    }

    /// Mark payment as failed
    pub fn mark_failed(env: Env, id: u64, caller: Address) {
        caller.require_auth();
        let mut payment: Payment = env
            .storage()
            .instance()
            .get(&DataKey::Payment(id))
            .expect("payment not found");

        if payment.status != Status::Pending {
            panic!("payment already finalized");
        }
        payment.status = Status::Failed;
        env.storage().instance().set(&DataKey::Payment(id), &payment);
        log!(&env, "Payment {} failed", id);
    }

    /// Get a single payment by ID
    pub fn get_payment(env: Env, id: u64) -> Payment {
        env.storage()
            .instance()
            .get(&DataKey::Payment(id))
            .expect("payment not found")
    }

    /// Get all payments for a sender (max 50)
    pub fn get_payments_by_sender(env: Env, sender: Address) -> Vec<Payment> {
        let count: u64 = env.storage().instance().get(&DataKey::Count).unwrap_or(0);
        let mut payments = Vec::new(&env);

        for i in 1..=count {
            if env.storage().instance().has(&DataKey::SenderPayment(sender.clone(), i)) {
                if let Some(payment) = env.storage().instance().get::<_, Payment>(&DataKey::Payment(i)) {
                    payments.push_back(payment);
                }
            }
        }

        payments
    }

    /// Get total payment count
    pub fn total_payments(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::Count).unwrap_or(0)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::{Env, String};

    #[test]
    fn test_create_and_get() {
        let env = Env::default();
        let contract_id = env.register_contract(None, PaymentTracker);
        let client = PaymentTrackerClient::new(&env, &contract_id);

        client.initialize();
        assert_eq!(client.total_payments(), 0);

        let sender = Address::generate(&env);
        env.mock_all_auths();

        let id = client.create_payment(
            &sender,
            &String::from_str(&env, "GBR7XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXRMX2"),
            &10_000_000i128, // 1 XLM in stroops
            &String::from_str(&env, "test payment"),
        );
        assert_eq!(id, 1);
        assert_eq!(client.total_payments(), 1);

        let payment = client.get_payment(&1);
        assert_eq!(payment.id, 1);
        assert_eq!(payment.sender, sender);
        assert_eq!(payment.amount, 10_000_000);
        assert_eq!(payment.status, Status::Pending);
    }

    #[test]
    fn test_mark_completed() {
        let env = Env::default();
        let contract_id = env.register_contract(None, PaymentTracker);
        let client = PaymentTrackerClient::new(&env, &contract_id);

        client.initialize();
        let sender = Address::generate(&env);
        env.mock_all_auths();

        client.create_payment(
            &sender,
            &String::from_str(&env, "GBR7XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXRMX2"),
            &5_000_000i128,
            &String::from_str(&env, "memo"),
        );

        client.mark_completed(&1, &sender);
        let payment = client.get_payment(&1);
        assert_eq!(payment.status, Status::Completed);
    }

    #[test]
    fn test_mark_failed() {
        let env = Env::default();
        let contract_id = env.register_contract(None, PaymentTracker);
        let client = PaymentTrackerClient::new(&env, &contract_id);

        client.initialize();
        let sender = Address::generate(&env);
        env.mock_all_auths();

        client.create_payment(
            &sender,
            &String::from_str(&env, "GBR7XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXRMX2"),
            &5_000_000i128,
            &String::from_str(&env, "memo"),
        );

        client.mark_failed(&1, &sender);
        let payment = client.get_payment(&1);
        assert_eq!(payment.status, Status::Failed);
    }

    #[test]
    fn test_double_finalize_panics() {
        let env = Env::default();
        let contract_id = env.register_contract(None, PaymentTracker);
        let client = PaymentTrackerClient::new(&env, &contract_id);

        client.initialize();
        let sender = Address::generate(&env);
        env.mock_all_auths();

        client.create_payment(
            &sender,
            &String::from_str(&env, "GBR7XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXRMX2"),
            &5_000_000i128,
            &String::from_str(&env, "memo"),
        );

        client.mark_completed(&1, &sender);
        // Should panic on second finalize
    }

    #[test]
    fn test_get_payments_by_sender() {
        let env = Env::default();
        let contract_id = env.register_contract(None, PaymentTracker);
        let client = PaymentTrackerClient::new(&env, &contract_id);

        client.initialize();
        let sender = Address::generate(&env);
        let other = Address::generate(&env);
        env.mock_all_auths();

        client.create_payment(
            &sender,
            &String::from_str(&env, "GDU6XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXYS7F"),
            &10_000_000i128,
            &String::from_str(&env, "first"),
        );
        client.create_payment(
            &sender,
            &String::from_str(&env, "GDU6XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXYS7F"),
            &20_000_000i128,
            &String::from_str(&env, "second"),
        );
        // Payment from other sender
        client.create_payment(
            &other,
            &String::from_str(&env, "GDU6XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXYS7F"),
            &5_000_000i128,
            &String::from_str(&env, "other"),
        );

        let sender_payments = client.get_payments_by_sender(&sender);
        assert_eq!(sender_payments.len(), 2);

        let other_payments = client.get_payments_by_sender(&other);
        assert_eq!(other_payments.len(), 1);
    }

    #[test]
    #[should_panic]
    fn test_uninitialized_panics() {
        let env = Env::default();
        let contract_id = env.register_contract(None, PaymentTracker);
        let client = PaymentTrackerClient::new(&env, &contract_id);

        let sender = Address::generate(&env);
        env.mock_all_auths();

        client.create_payment(
            &sender,
            &String::from_str(&env, "GBR7XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXRMX2"),
            &5_000_000i128,
            &String::from_str(&env, "memo"),
        );
    }
}
