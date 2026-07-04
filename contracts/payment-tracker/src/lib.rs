#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, log, Env, Address, String, Vec, Map};

// ── Status enum ──
#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum PaymentStatus {
    Pending,
    Completed,
    Failed,
}

// ── Payment struct ──
#[derive(Clone, Debug)]
#[contracttype]
pub struct Payment {
    pub id: u64,
    pub sender: Address,
    pub receiver: String,
    pub amount: i128,
    pub memo: String,
    pub timestamp: u64,
    pub status: PaymentStatus,
}

// ── Key types ──
#[derive(Clone, Debug)]
#[contracttype]
pub enum DataKey {
    Payment(u64),
    NextId,
    SenderPayments(Address, u64),  // address + index
    SenderCount(Address),
    ReceiverPayments(String, u64), // address string + index
    ReceiverCount(String),
}

// ── Events ──
#[derive(Clone, Debug)]
#[contracttype]
pub enum PaymentEvent {
    Created { id: u64, sender: Address, receiver: String, amount: i128 },
    Completed { id: u64 },
    Failed { id: u64 },
}

// ── Contract ──
#[contract]
pub struct PaymentTracker;

#[contractimpl]
impl PaymentTracker {
    /// Initialize — set next ID to 1
    pub fn initialize(env: Env) {
        if env.storage().instance().has(&DataKey::NextId) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&DataKey::NextId, &1u64);
    }

    /// Create a new payment record
    pub fn create_payment(
        env: Env,
        sender: Address,
        receiver: String,
        amount: i128,
        memo: String,
    ) -> u64 {
        // Authenticate sender
        sender.require_auth();

        // Get next ID
        let mut next_id: u64 = env.storage().instance().get(&DataKey::NextId).unwrap_or(1);
        let id = next_id;
        next_id += 1;
        env.storage().instance().set(&DataKey::NextId, &next_id);

        let payment = Payment {
            id,
            sender: sender.clone(),
            receiver: receiver.clone(),
            amount,
            memo: memo.clone(),
            timestamp: env.ledger().timestamp(),
            status: PaymentStatus::Pending,
        };

        // Store payment
        env.storage().persistent().set(&DataKey::Payment(id), &payment);

        // Index by sender
        let sender_count: u64 = env.storage().persistent().get(&DataKey::SenderCount(sender.clone())).unwrap_or(0);
        env.storage().persistent().set(&DataKey::SenderPayments(sender.clone(), sender_count), &id);
        env.storage().persistent().set(&DataKey::SenderCount(sender.clone()), &(sender_count + 1));

        // Index by receiver (store as string for external addresses)
        let receiver_count: u64 = env.storage().persistent().get(&DataKey::ReceiverCount(receiver.clone())).unwrap_or(0);
        env.storage().persistent().set(&DataKey::ReceiverPayments(receiver.clone(), receiver_count), &id);
        env.storage().persistent().set(&DataKey::ReceiverCount(receiver.clone()), &(receiver_count + 1));

        // Emit event
        env.events().publish(("PaymentTracker", "Created"), PaymentEvent::Created {
            id, sender: sender.clone(), receiver: receiver.clone(), amount,
        });

        id
    }

    /// Mark payment as completed
    pub fn mark_completed(env: Env, id: u64, caller: Address) {
        caller.require_auth();

        let mut payment: Payment = env.storage().persistent().get(&DataKey::Payment(id))
            .expect("Payment not found");

        if payment.sender != caller {
            panic!("Only sender can mark completed");
        }
        if payment.status != PaymentStatus::Pending {
            panic!("Payment is not pending");
        }

        payment.status = PaymentStatus::Completed;
        env.storage().persistent().set(&DataKey::Payment(id), &payment);

        env.events().publish(("PaymentTracker", "Completed"), PaymentEvent::Completed { id });
    }

    /// Mark payment as failed
    pub fn mark_failed(env: Env, id: u64, caller: Address) {
        caller.require_auth();

        let mut payment: Payment = env.storage().persistent().get(&DataKey::Payment(id))
            .expect("Payment not found");

        if payment.sender != caller {
            panic!("Only sender can mark failed");
        }
        if payment.status != PaymentStatus::Pending {
            panic!("Payment is not pending");
        }

        payment.status = PaymentStatus::Failed;
        env.storage().persistent().set(&DataKey::Payment(id), &payment);

        env.events().publish(("PaymentTracker", "Failed"), PaymentEvent::Failed { id });
    }

    /// Get single payment
    pub fn get_payment(env: Env, id: u64) -> Payment {
        env.storage().persistent().get(&DataKey::Payment(id))
            .expect("Payment not found")
    }

    /// Get payments by sender address
    pub fn get_payments_by_sender(env: Env, sender: Address) -> Vec<Payment> {
        let count: u64 = env.storage().persistent().get(&DataKey::SenderCount(sender.clone())).unwrap_or(0);
        let mut payments: Vec<Payment> = Vec::new(&env);
        for i in (0..count).rev() {
            let id: u64 = env.storage().persistent().get(&DataKey::SenderPayments(sender.clone(), i)).unwrap();
            let payment: Payment = env.storage().persistent().get(&DataKey::Payment(id)).unwrap();
            payments.push_back(payment);
        }
        payments
    }

    /// Get payments by receiver address
    pub fn get_payments_by_receiver(env: Env, receiver: String) -> Vec<Payment> {
        let count: u64 = env.storage().persistent().get(&DataKey::ReceiverCount(receiver.clone())).unwrap_or(0);
        let mut payments: Vec<Payment> = Vec::new(&env);
        for i in (0..count).rev() {
            let id: u64 = env.storage().persistent().get(&DataKey::ReceiverPayments(receiver.clone(), i)).unwrap();
            let payment: Payment = env.storage().persistent().get(&DataKey::Payment(id)).unwrap();
            payments.push_back(payment);
        }
        payments
    }

    /// Get total payment count
    pub fn total_payments(env: Env) -> u64 {
        let next: u64 = env.storage().instance().get(&DataKey::NextId).unwrap_or(1);
        next - 1
    }
}

// ── Tests ──
#[cfg(test)]
mod test;
