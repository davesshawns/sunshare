#![cfg(test)]

use super::*;
use ed25519_dalek::{Signer, SigningKey};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Bytes, BytesN, Env, Symbol,
};

fn setup_test() -> (
    Env,
    Address,
    SunshareContractClient<'static>,
    Address,
    token::Client<'static>,
    token::StellarAssetClient<'static>,
    Address,
    Address,
    SigningKey,
    BytesN<32>,
) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(SunshareContract, ());
    let client = SunshareContractClient::new(&env, &contract_id);

    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_client = token::Client::new(&env, &token_contract.address());
    let token_admin_client = token::StellarAssetClient::new(&env, &token_contract.address());

    let producer = Address::generate(&env);
    let consumer = Address::generate(&env);

    // Generate smart meter Ed25519 keypair
    let signing_key = SigningKey::from_bytes(&[42u8; 32]);
    let verifying_key = signing_key.verifying_key();
    let meter_pubkey = BytesN::from_array(&env, &verifying_key.to_bytes());

    (
        env,
        contract_id,
        client,
        token_contract.address(),
        token_client,
        token_admin_client,
        producer,
        consumer,
        signing_key,
        meter_pubkey,
    )
}

fn sign_delivery(
    env: &Env,
    signing_key: &SigningKey,
    reservation_id: u64,
    kwh_delivered: u64,
    meter_timestamp: u64,
    nonce: &BytesN<32>,
) -> BytesN<64> {
    let mut payload = Bytes::new(env);
    payload.append(&Bytes::from_array(env, &reservation_id.to_be_bytes()));
    payload.append(&Bytes::from_array(env, &kwh_delivered.to_be_bytes()));
    payload.append(&Bytes::from_array(env, &meter_timestamp.to_be_bytes()));
    payload.append(&Bytes::from_array(env, &nonce.to_array()));

    let msg_hash = env.crypto().sha256(&payload);
    let sig = signing_key.sign(&msg_hash.to_array());
    BytesN::from_array(env, &sig.to_bytes())
}

#[test]
fn test_create_offer_and_reservation() {
    let (
        env,
        _contract_id,
        client,
        token_addr,
        token_client,
        token_admin_client,
        producer,
        consumer,
        _signing_key,
        meter_pubkey,
    ) = setup_test();

    // Fund consumer with 500 XLM (5_000_000_000 stroops)
    token_admin_client.mint(&consumer, &5_000_000_000);

    let offer_id = 1u64;
    let total_capacity = 100u64; // 100 kWh
    let price_per_kwh = 5_000_000i128; // 0.5 XLM / kWh
    let window_start = 1000u64;
    let window_end = 5000u64;
    let zone_id = Symbol::new(&env, "ZONE_A");

    let offer = client.create_offer(
        &offer_id,
        &producer,
        &token_addr,
        &total_capacity,
        &price_per_kwh,
        &window_start,
        &window_end,
        &zone_id,
        &meter_pubkey,
    );

    assert_eq!(offer.total_capacity_kwh, 100);
    assert_eq!(offer.available_capacity_kwh, 100);
    assert_eq!(offer.status, OfferStatus::Active);

    // Consumer reserves 40 kWh
    let res_id = 101u64;
    let reservation = client.create_reservation(&res_id, &offer_id, &consumer, &40);

    assert_eq!(reservation.kwh_reserved, 40);
    assert_eq!(reservation.total_deposit_stroops, 200_000_000); // 40 * 5_000_000
    assert_eq!(reservation.status, ReservationStatus::Locked);

    // Verify offer capacity decreased
    let updated_offer = client.get_offer(&offer_id);
    assert_eq!(updated_offer.available_capacity_kwh, 60);

    // Verify consumer paid escrow
    assert_eq!(token_client.balance(&consumer), 4_800_000_000);
}

#[test]
fn test_full_delivery_verification_and_settlement() {
    let (
        env,
        contract_id,
        client,
        token_addr,
        token_client,
        token_admin_client,
        producer,
        consumer,
        signing_key,
        meter_pubkey,
    ) = setup_test();

    token_admin_client.mint(&consumer, &1_000_000_000);

    let offer_id = 1u64;
    let window_start = 1000u64;
    let window_end = 5000u64;

    client.create_offer(
        &offer_id,
        &producer,
        &token_addr,
        &50,
        &10_000_000, // 1 XLM / kWh
        &window_start,
        &window_end,
        &Symbol::new(&env, "ZONE_B"),
        &meter_pubkey,
    );

    let res_id = 201u64;
    client.create_reservation(&res_id, &offer_id, &consumer, &30); // 30 XLM deposit = 300_000_000 stroops

    assert_eq!(token_client.balance(&contract_id), 300_000_000);
    assert_eq!(token_client.balance(&producer), 0);

    // Generate signed meter delivery proof for 30 kWh
    let nonce = BytesN::from_array(&env, &[7u8; 32]);
    let delivery_ts = 2500u64;
    let signature = sign_delivery(&env, &signing_key, res_id, 30, delivery_ts, &nonce);

    let settled_res = client.verify_and_settle(&res_id, &30, &delivery_ts, &nonce, &signature);

    assert_eq!(settled_res.status, ReservationStatus::Delivered);
    assert_eq!(settled_res.delivered_kwh, 30);

    // Producer received full 300_000_000 stroops
    assert_eq!(token_client.balance(&producer), 300_000_000);
    assert_eq!(token_client.balance(&contract_id), 0);

    // Check producer reputation
    let rep = client.get_reputation(&producer);
    assert_eq!(rep.total_delivered_kwh, 30);
    assert_eq!(rep.successful_deliveries, 1);
    assert_eq!(rep.disputes_count, 0);
}

#[test]
fn test_partial_delivery_settlement_with_refund() {
    let (
        env,
        contract_id,
        client,
        token_addr,
        token_client,
        token_admin_client,
        producer,
        consumer,
        signing_key,
        meter_pubkey,
    ) = setup_test();

    token_admin_client.mint(&consumer, &1_000_000_000);

    let offer_id = 2u64;
    let window_start = 1000u64;
    let window_end = 5000u64;

    client.create_offer(
        &offer_id,
        &producer,
        &token_addr,
        &50,
        &10_000_000, // 1 XLM / kWh
        &window_start,
        &window_end,
        &Symbol::new(&env, "ZONE_B"),
        &meter_pubkey,
    );

    let res_id = 202u64;
    client.create_reservation(&res_id, &offer_id, &consumer, &40); // 40 XLM = 400_000_000 stroops

    assert_eq!(token_client.balance(&consumer), 600_000_000);

    // Meter only delivers 25 kWh due to cloud cover
    let nonce = BytesN::from_array(&env, &[9u8; 32]);
    let delivery_ts = 3000u64;
    let signature = sign_delivery(&env, &signing_key, res_id, 25, delivery_ts, &nonce);

    let settled_res = client.verify_and_settle(&res_id, &25, &delivery_ts, &nonce, &signature);

    assert_eq!(settled_res.status, ReservationStatus::Delivered);
    assert_eq!(settled_res.delivered_kwh, 25);

    // Producer gets 25 XLM (250_000_000)
    assert_eq!(token_client.balance(&producer), 250_000_000);

    // Consumer gets 15 XLM refund (150_000_000) -> 600m + 150m = 750m
    assert_eq!(token_client.balance(&consumer), 750_000_000);
    assert_eq!(token_client.balance(&contract_id), 0);
}

#[test]
fn test_replay_attack_rejected() {
    let (
        env,
        _contract_id,
        client,
        token_addr,
        _token_client,
        token_admin_client,
        producer,
        consumer,
        signing_key,
        meter_pubkey,
    ) = setup_test();

    token_admin_client.mint(&consumer, &1_000_000_000);

    let offer_id = 3u64;
    client.create_offer(
        &offer_id,
        &producer,
        &token_addr,
        &50,
        &10_000_000,
        &1000,
        &5000,
        &Symbol::new(&env, "ZONE_A"),
        &meter_pubkey,
    );

    let res_id = 301u64;
    client.create_reservation(&res_id, &offer_id, &consumer, &20);

    let nonce = BytesN::from_array(&env, &[12u8; 32]);
    let signature = sign_delivery(&env, &signing_key, res_id, 20, 2000, &nonce);

    // First settlement succeeds
    client.verify_and_settle(&res_id, &20, &2000, &nonce, &signature);

    // Attempt to settle again with identical nonce must fail
    let res2_id = 302u64;
    client.create_reservation(&res2_id, &offer_id, &consumer, &10);
    let signature2 = sign_delivery(&env, &signing_key, res2_id, 10, 2100, &nonce);

    let result = client.try_verify_and_settle(&res2_id, &10, &2100, &nonce, &signature2);
    assert_eq!(result, Err(Ok(SunshareError::NonceAlreadyUsed)));
}

#[test]
fn test_refund_expired_reservation() {
    let (
        env,
        contract_id,
        client,
        token_addr,
        token_client,
        token_admin_client,
        producer,
        consumer,
        _signing_key,
        meter_pubkey,
    ) = setup_test();

    token_admin_client.mint(&consumer, &1_000_000_000);

    let offer_id = 4u64;
    client.create_offer(
        &offer_id,
        &producer,
        &token_addr,
        &50,
        &10_000_000,
        &1000,
        &5000, // window end = 5000 -> expiry = 5000 + 3600 = 8600
        &Symbol::new(&env, "ZONE_C"),
        &meter_pubkey,
    );

    let res_id = 401u64;
    client.create_reservation(&res_id, &offer_id, &consumer, &30);

    assert_eq!(token_client.balance(&consumer), 700_000_000);

    // Attempt refund before expiry fails
    env.ledger().set_timestamp(5000);
    let early_res = client.try_refund_expired_reservation(&res_id);
    assert_eq!(early_res, Err(Ok(SunshareError::ReservationNotExpired)));

    // Fast forward ledger past expiry (8601)
    env.ledger().set_timestamp(8601);
    let refunded = client.refund_expired_reservation(&res_id);

    assert_eq!(refunded.status, ReservationStatus::Expired);
    // Consumer received 100% refund (300_000_000) -> 1_000_000_000 total
    assert_eq!(token_client.balance(&consumer), 1_000_000_000);
    assert_eq!(token_client.balance(&contract_id), 0);
}

#[test]
fn test_community_pool_lifecycle() {
    let (
        env,
        _contract_id,
        client,
        token_addr,
        token_client,
        token_admin_client,
        creator,
        consumer,
        _signing_key,
        _meter_pubkey,
    ) = setup_test();

    let contributor2 = Address::generate(&env);
    let installer = Address::generate(&env);

    token_admin_client.mint(&consumer, &5_000_000_000);
    token_admin_client.mint(&contributor2, &5_000_000_000);

    let pool_id = 501u64;
    let target = 2_000_000_000i128; // 200 XLM target
    let deadline = 100_000u64;

    let pool = client.create_pool(
        &pool_id,
        &creator,
        &token_addr,
        &Symbol::new(&env, "SOLAR_COMMUNITY_1"),
        &target,
        &deadline,
    );

    assert_eq!(pool.status, PoolStatus::Funding);
    assert_eq!(pool.current_funding_stroops, 0);

    // First contributor provides 120 XLM (1_200_000_000 stroops)
    let pool_mid = client.contribute_to_pool(&pool_id, &consumer, &1_200_000_000);
    assert_eq!(pool_mid.status, PoolStatus::Funding);
    assert_eq!(pool_mid.current_funding_stroops, 1_200_000_000);

    // Second contributor provides 80 XLM (800_000_000 stroops)
    let pool_funded = client.contribute_to_pool(&pool_id, &contributor2, &800_000_000);
    assert_eq!(pool_funded.status, PoolStatus::GoalReached);
    assert_eq!(pool_funded.current_funding_stroops, 2_000_000_000);

    // Creator withdraws to installer
    let pool_withdrawn = client.withdraw_pool_funds(&pool_id, &installer);
    assert_eq!(pool_withdrawn.status, PoolStatus::Withdrawn);
    assert_eq!(token_client.balance(&installer), 2_000_000_000);
}

#[test]
fn test_dispute_resolution() {
    let (
        env,
        contract_id,
        client,
        token_addr,
        token_client,
        token_admin_client,
        producer,
        consumer,
        _signing_key,
        meter_pubkey,
    ) = setup_test();

    let arbiter = Address::generate(&env);
    token_admin_client.mint(&consumer, &1_000_000_000);

    let offer_id = 5u64;
    client.create_offer(
        &offer_id,
        &producer,
        &token_addr,
        &50,
        &10_000_000,
        &1000,
        &5000,
        &Symbol::new(&env, "ZONE_A"),
        &meter_pubkey,
    );

    let res_id = 501u64;
    client.create_reservation(&res_id, &offer_id, &consumer, &20); // 200_000_000 deposit

    // Arbiter splits: 140_000_000 to producer (70%), 60_000_000 to consumer (30%)
    let resolved = client.resolve_dispute(&res_id, &arbiter, &140_000_000, &60_000_000);

    assert_eq!(resolved.status, ReservationStatus::Disputed);
    assert_eq!(token_client.balance(&producer), 140_000_000);
    assert_eq!(token_client.balance(&consumer), 860_000_000); // 800m + 60m
    assert_eq!(token_client.balance(&contract_id), 0);
}
