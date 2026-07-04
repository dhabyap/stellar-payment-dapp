#![cfg(test)]

use super::*;
use soroban_sdk::{symbol_short, vec, Env, String, Address};

#[test]
fn test_full_flow() {
    let env = Env::default();
    let contract_id = env.register_contract(None, PaymentTracker);
    let client = PaymentTrackerClient::new(&env, &contract_id);

    let sender = Address::generate(&env);
    let receiver = String::from_str(&env, "GDU6XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXYS7F");

    // Initialize
    client.initialize();

    // Create payment
    let id = client.create_payment(&sender, &receiver, &1_000_000, &String::from_str(&env, "Test payment"));
    assert!(id >= 1);

    // Get payment
    let payment = client.get_payment(&id);
    assert_eq!(payment.sender, sender);
    assert_eq!(payment.receiver, receiver);
    assert_eq!(payment.amount, 1_000_000);
    assert_eq!(payment.status, PaymentStatus::Pending);

    // Mark completed
    client.mark_completed(&id, &sender);
    let payment = client.get_payment(&id);
    assert_eq!(payment.status, PaymentStatus::Completed);

    // Total
    assert_eq!(client.total_payments(), 1);
}

#[test]
fn test_multiple_payments() {
    let env = Env::default();
    let contract_id = env.register_contract(None, PaymentTracker);
    let client = PaymentTrackerClient::new(&env, &contract_id);

    let sender = Address::generate(&env);
    let receiver1 = String::from_str(&env, "GDU6XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXYS7F");
    let receiver2 = String::from_str(&env, "GBR7XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXRMX2");

    client.initialize();

    let id1 = client.create_payment(&sender, &receiver1, &500_000, &String::from_str(&env, "First"));
    let id2 = client.create_payment(&sender, &receiver2, &750_000, &String::from_str(&env, "Second"));

    // Sender payments
    let payments = client.get_payments_by_sender(&sender);
    assert_eq!(payments.len(), 2);

    // Receiver payments
    let r1_payments = client.get_payments_by_receiver(&receiver1);
    assert_eq!(r1_payments.len(), 1);

    let r2_payments = client.get_payments_by_receiver(&receiver2);
    assert_eq!(r2_payments.len(), 1);

    assert_eq!(client.total_payments(), 2);
}

#[test]
#[should_panic(expected = "Already initialized")]
fn test_double_init() {
    let env = Env::default();
    let contract_id = env.register_contract(None, PaymentTracker);
    let client = PaymentTrackerClient::new(&env, &contract_id);
    client.initialize();
    client.initialize();
}
