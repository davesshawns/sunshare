use soroban_sdk::{symbol_short, Address, Env};

pub fn emit_offer_created(
    env: &Env,
    offer_id: u64,
    producer: &Address,
    capacity_kwh: u64,
    price_per_kwh: i128,
) {
    env.events().publish(
        (symbol_short!("sunshare"), symbol_short!("offer"), offer_id),
        (producer.clone(), capacity_kwh, price_per_kwh),
    );
}

pub fn emit_reservation_created(
    env: &Env,
    reservation_id: u64,
    offer_id: u64,
    consumer: &Address,
    kwh: u64,
    deposit: i128,
) {
    env.events().publish(
        (symbol_short!("sunshare"), symbol_short!("reserve"), reservation_id),
        (offer_id, consumer.clone(), kwh, deposit),
    );
}

pub fn emit_delivery_settled(
    env: &Env,
    reservation_id: u64,
    producer: &Address,
    consumer: &Address,
    delivered_kwh: u64,
    payout: i128,
    refund: i128,
) {
    env.events().publish(
        (symbol_short!("sunshare"), symbol_short!("settled"), reservation_id),
        (producer.clone(), consumer.clone(), delivered_kwh, payout, refund),
    );
}

pub fn emit_reservation_refunded(
    env: &Env,
    reservation_id: u64,
    consumer: &Address,
    amount: i128,
) {
    env.events().publish(
        (symbol_short!("sunshare"), symbol_short!("refund"), reservation_id),
        (consumer.clone(), amount),
    );
}

pub fn emit_pool_created(
    env: &Env,
    pool_id: u64,
    creator: &Address,
    target_amount: i128,
) {
    env.events().publish(
        (symbol_short!("sunshare"), symbol_short!("pool_new"), pool_id),
        (creator.clone(), target_amount),
    );
}

pub fn emit_pool_contributed(
    env: &Env,
    pool_id: u64,
    member: &Address,
    amount: i128,
    total_funded: i128,
) {
    env.events().publish(
        (symbol_short!("sunshare"), symbol_short!("contrib"), pool_id),
        (member.clone(), amount, total_funded),
    );
}

pub fn emit_dispute_resolved(
    env: &Env,
    reservation_id: u64,
    producer_amount: i128,
    consumer_amount: i128,
) {
    env.events().publish(
        (symbol_short!("sunshare"), symbol_short!("disp_res"), reservation_id),
        (producer_amount, consumer_amount),
    );
}

