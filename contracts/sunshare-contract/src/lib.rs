#![no_std]
use soroban_sdk::{
    contract, contractimpl, token, Address, Bytes, BytesN, Env, Symbol,
};

pub mod events;
pub mod types;

use crate::events::*;
use crate::types::*;

const LEDGER_THRESHOLD: u32 = 100_000;
const LEDGER_EXTEND_TO: u32 = 200_000;

#[contract]
pub struct SunshareContract;

#[contractimpl]
impl SunshareContract {
    /// Producer publishes a peer-to-peer energy offer
    pub fn create_offer(
        env: Env,
        offer_id: u64,
        producer: Address,
        token: Address,
        total_capacity_kwh: u64,
        price_per_kwh_stroops: i128,
        window_start: u64,
        window_end: u64,
        zone_id: Symbol,
        meter_pubkey: BytesN<32>,
    ) -> Result<EnergyOffer, SunshareError> {
        producer.require_auth();

        if total_capacity_kwh == 0 || price_per_kwh_stroops <= 0 {
            return Err(SunshareError::InvalidAmount);
        }

        if window_end <= window_start {
            return Err(SunshareError::DeliveryTimestampInvalid);
        }

        let key = DataKey::Offer(offer_id);
        if env.storage().persistent().has(&key) {
            return Err(SunshareError::OfferAlreadyExists);
        }

        let offer = EnergyOffer {
            offer_id,
            producer: producer.clone(),
            token: token.clone(),
            total_capacity_kwh,
            available_capacity_kwh: total_capacity_kwh,
            price_per_kwh_stroops,
            window_start,
            window_end,
            zone_id,
            meter_pubkey,
            status: OfferStatus::Active,
            created_at: env.ledger().timestamp(),
        };

        env.storage().persistent().set(&key, &offer);
        env.storage()
            .persistent()
            .extend_ttl(&key, LEDGER_THRESHOLD, LEDGER_EXTEND_TO);

        emit_offer_created(
            &env,
            offer_id,
            &producer,
            total_capacity_kwh,
            price_per_kwh_stroops,
        );

        Ok(offer)
    }

    /// Consumer reserves energy from an active offer and locks payment escrow
    pub fn create_reservation(
        env: Env,
        reservation_id: u64,
        offer_id: u64,
        consumer: Address,
        kwh_to_reserve: u64,
    ) -> Result<EnergyReservation, SunshareError> {
        consumer.require_auth();

        if kwh_to_reserve == 0 {
            return Err(SunshareError::InvalidAmount);
        }

        let offer_key = DataKey::Offer(offer_id);
        let mut offer: EnergyOffer = env
            .storage()
            .persistent()
            .get(&offer_key)
            .ok_or(SunshareError::OfferNotFound)?;

        if offer.status != OfferStatus::Active {
            return Err(SunshareError::OfferNotActive);
        }

        if kwh_to_reserve > offer.available_capacity_kwh {
            return Err(SunshareError::InsufficientCapacity);
        }

        let res_key = DataKey::Reservation(reservation_id);
        if env.storage().persistent().has(&res_key) {
            return Err(SunshareError::Unauthorized);
        }

        // Calculate total deposit in stroops
        let total_deposit = (kwh_to_reserve as i128)
            .checked_mul(offer.price_per_kwh_stroops)
            .ok_or(SunshareError::ArithmeticOverflow)?;

        // Deduct available capacity (prevents overselling)
        offer.available_capacity_kwh -= kwh_to_reserve;
        if offer.available_capacity_kwh == 0 {
            offer.status = OfferStatus::Completed;
        }

        // Grace period for meter sync: 1 hour after window end
        let expiry = offer.window_end + 3600;

        // Lock payment from consumer to contract escrow
        let token_client = token::Client::new(&env, &offer.token);
        token_client.transfer(
            &consumer,
            &env.current_contract_address(),
            &total_deposit,
        );

        let reservation = EnergyReservation {
            reservation_id,
            offer_id,
            producer: offer.producer.clone(),
            consumer: consumer.clone(),
            token: offer.token.clone(),
            kwh_reserved: kwh_to_reserve,
            total_deposit_stroops: total_deposit,
            expiry_timestamp: expiry,
            status: ReservationStatus::Locked,
            delivered_kwh: 0,
            settled_at: 0,
        };

        env.storage().persistent().set(&offer_key, &offer);
        env.storage()
            .persistent()
            .extend_ttl(&offer_key, LEDGER_THRESHOLD, LEDGER_EXTEND_TO);

        env.storage().persistent().set(&res_key, &reservation);
        env.storage()
            .persistent()
            .extend_ttl(&res_key, LEDGER_THRESHOLD, LEDGER_EXTEND_TO);

        emit_reservation_created(
            &env,
            reservation_id,
            offer_id,
            &consumer,
            kwh_to_reserve,
            total_deposit,
        );

        Ok(reservation)
    }

    /// Verifies signed meter evidence and settles payment directly to producer
    pub fn verify_and_settle(
        env: Env,
        reservation_id: u64,
        kwh_delivered: u64,
        meter_timestamp: u64,
        nonce: BytesN<32>,
        signature: BytesN<64>,
    ) -> Result<EnergyReservation, SunshareError> {
        let res_key = DataKey::Reservation(reservation_id);
        let mut reservation: EnergyReservation = env
            .storage()
            .persistent()
            .get(&res_key)
            .ok_or(SunshareError::ReservationNotFound)?;

        if reservation.status != ReservationStatus::Locked {
            return Err(SunshareError::ReservationNotLocked);
        }

        let offer_key = DataKey::Offer(reservation.offer_id);
        let offer: EnergyOffer = env
            .storage()
            .persistent()
            .get(&offer_key)
            .ok_or(SunshareError::OfferNotFound)?;

        // Replay attack prevention: verify nonce has never been used
        let nonce_key = DataKey::UsedNonce(nonce.clone());
        if env.storage().persistent().has(&nonce_key) {
            return Err(SunshareError::NonceAlreadyUsed);
        }

        if kwh_delivered == 0 {
            return Err(SunshareError::ZeroDelivery);
        }

        if meter_timestamp < offer.window_start {
            return Err(SunshareError::DeliveryTimestampInvalid);
        }

        // Build canonical signed payload:
        // SHA256(reservation_id [8 bytes] || kwh_delivered [8 bytes] || meter_timestamp [8 bytes] || nonce [32 bytes])
        let mut payload = Bytes::new(&env);
        payload.append(&Bytes::from_array(&env, &reservation_id.to_be_bytes()));
        payload.append(&Bytes::from_array(&env, &kwh_delivered.to_be_bytes()));
        payload.append(&Bytes::from_array(&env, &meter_timestamp.to_be_bytes()));
        payload.append(&Bytes::from_array(&env, &nonce.to_array()));

        let msg_hash = env.crypto().sha256(&payload);

        // Cryptographically verify smart meter's Ed25519 signature
        env.crypto().ed25519_verify(
            &offer.meter_pubkey,
            &Bytes::from_array(&env, &msg_hash.to_array()),
            &signature,
        );

        // Mark nonce as consumed
        env.storage().persistent().set(&nonce_key, &true);
        env.storage()
            .persistent()
            .extend_ttl(&nonce_key, LEDGER_THRESHOLD, LEDGER_EXTEND_TO);

        // Proportional accounting for delivered energy
        let effective_kwh = if kwh_delivered < reservation.kwh_reserved {
            kwh_delivered
        } else {
            reservation.kwh_reserved
        };

        let payout_stroops = (effective_kwh as i128)
            .checked_mul(offer.price_per_kwh_stroops)
            .ok_or(SunshareError::ArithmeticOverflow)?;

        let refund_stroops = reservation
            .total_deposit_stroops
            .checked_sub(payout_stroops)
            .ok_or(SunshareError::ArithmeticOverflow)?;

        let token_client = token::Client::new(&env, &reservation.token);

        // Release payment to energy producer
        if payout_stroops > 0 {
            token_client.transfer(
                &env.current_contract_address(),
                &reservation.producer,
                &payout_stroops,
            );
        }

        // Return leftover funds to consumer if partial delivery
        if refund_stroops > 0 {
            token_client.transfer(
                &env.current_contract_address(),
                &reservation.consumer,
                &refund_stroops,
            );
        }

        let now = env.ledger().timestamp();
        reservation.status = ReservationStatus::Delivered;
        reservation.delivered_kwh = effective_kwh;
        reservation.settled_at = now;

        env.storage().persistent().set(&res_key, &reservation);
        env.storage()
            .persistent()
            .extend_ttl(&res_key, LEDGER_THRESHOLD, LEDGER_EXTEND_TO);

        // Update on-chain reputation for the producer
        let rep_key = DataKey::Reputation(reservation.producer.clone());
        let mut rep: ProducerReputation = env
            .storage()
            .persistent()
            .get(&rep_key)
            .unwrap_or(ProducerReputation {
                total_delivered_kwh: 0,
                successful_deliveries: 0,
                disputes_count: 0,
            });

        rep.total_delivered_kwh = rep
            .total_delivered_kwh
            .checked_add(effective_kwh)
            .ok_or(SunshareError::ArithmeticOverflow)?;
        rep.successful_deliveries += 1;

        env.storage().persistent().set(&rep_key, &rep);
        env.storage()
            .persistent()
            .extend_ttl(&rep_key, LEDGER_THRESHOLD, LEDGER_EXTEND_TO);

        emit_delivery_settled(
            &env,
            reservation_id,
            &reservation.producer,
            &reservation.consumer,
            effective_kwh,
            payout_stroops,
            refund_stroops,
        );

        Ok(reservation)
    }

    /// Refunds expired reservation if no valid meter reading was settled
    pub fn refund_expired_reservation(
        env: Env,
        reservation_id: u64,
    ) -> Result<EnergyReservation, SunshareError> {
        let res_key = DataKey::Reservation(reservation_id);
        let mut reservation: EnergyReservation = env
            .storage()
            .persistent()
            .get(&res_key)
            .ok_or(SunshareError::ReservationNotFound)?;

        if reservation.status != ReservationStatus::Locked {
            return Err(SunshareError::ReservationNotLocked);
        }

        if env.ledger().timestamp() <= reservation.expiry_timestamp {
            return Err(SunshareError::ReservationNotExpired);
        }

        let token_client = token::Client::new(&env, &reservation.token);
        token_client.transfer(
            &env.current_contract_address(),
            &reservation.consumer,
            &reservation.total_deposit_stroops,
        );

        reservation.status = ReservationStatus::Expired;
        reservation.settled_at = env.ledger().timestamp();

        env.storage().persistent().set(&res_key, &reservation);
        env.storage()
            .persistent()
            .extend_ttl(&res_key, LEDGER_THRESHOLD, LEDGER_EXTEND_TO);

        emit_reservation_refunded(
            &env,
            reservation_id,
            &reservation.consumer,
            reservation.total_deposit_stroops,
        );

        Ok(reservation)
    }

    /// Creates a community energy pool for funding local solar equipment
    pub fn create_pool(
        env: Env,
        pool_id: u64,
        creator: Address,
        token: Address,
        title: Symbol,
        target_funding_stroops: i128,
        deadline: u64,
    ) -> Result<CommunityPool, SunshareError> {
        creator.require_auth();

        if target_funding_stroops <= 0 {
            return Err(SunshareError::InvalidAmount);
        }

        let pool_key = DataKey::Pool(pool_id);
        if env.storage().persistent().has(&pool_key) {
            return Err(SunshareError::Unauthorized);
        }

        let pool = CommunityPool {
            pool_id,
            creator: creator.clone(),
            token,
            title,
            target_funding_stroops,
            current_funding_stroops: 0,
            deadline,
            status: PoolStatus::Funding,
            created_at: env.ledger().timestamp(),
        };

        env.storage().persistent().set(&pool_key, &pool);
        env.storage()
            .persistent()
            .extend_ttl(&pool_key, LEDGER_THRESHOLD, LEDGER_EXTEND_TO);

        emit_pool_created(&env, pool_id, &creator, target_funding_stroops);

        Ok(pool)
    }

    /// Contributes funds to a community energy pool
    pub fn contribute_to_pool(
        env: Env,
        pool_id: u64,
        member: Address,
        amount_stroops: i128,
    ) -> Result<CommunityPool, SunshareError> {
        member.require_auth();

        if amount_stroops <= 0 {
            return Err(SunshareError::InvalidAmount);
        }

        let pool_key = DataKey::Pool(pool_id);
        let mut pool: CommunityPool = env
            .storage()
            .persistent()
            .get(&pool_key)
            .ok_or(SunshareError::PoolNotFound)?;

        if pool.status != PoolStatus::Funding {
            return Err(SunshareError::PoolAlreadyFinalized);
        }

        let token_client = token::Client::new(&env, &pool.token);
        token_client.transfer(
            &member,
            &env.current_contract_address(),
            &amount_stroops,
        );

        pool.current_funding_stroops = pool
            .current_funding_stroops
            .checked_add(amount_stroops)
            .ok_or(SunshareError::ArithmeticOverflow)?;

        if pool.current_funding_stroops >= pool.target_funding_stroops {
            pool.status = PoolStatus::GoalReached;
        }

        // Record member contribution
        let contrib_key = DataKey::PoolContribution(pool_id, member.clone());
        let prev_contrib: i128 = env.storage().persistent().get(&contrib_key).unwrap_or(0);
        env.storage()
            .persistent()
            .set(&contrib_key, &(prev_contrib + amount_stroops));
        env.storage()
            .persistent()
            .extend_ttl(&contrib_key, LEDGER_THRESHOLD, LEDGER_EXTEND_TO);

        env.storage().persistent().set(&pool_key, &pool);
        env.storage()
            .persistent()
            .extend_ttl(&pool_key, LEDGER_THRESHOLD, LEDGER_EXTEND_TO);

        emit_pool_contributed(
            &env,
            pool_id,
            &member,
            amount_stroops,
            pool.current_funding_stroops,
        );

        Ok(pool)
    }

    /// Withdraws pool funds to the installer/recipient upon reaching goal
    pub fn withdraw_pool_funds(
        env: Env,
        pool_id: u64,
        recipient: Address,
    ) -> Result<CommunityPool, SunshareError> {
        let pool_key = DataKey::Pool(pool_id);
        let mut pool: CommunityPool = env
            .storage()
            .persistent()
            .get(&pool_key)
            .ok_or(SunshareError::PoolNotFound)?;

        pool.creator.require_auth();

        if pool.status != PoolStatus::GoalReached {
            return Err(SunshareError::PoolGoalNotReached);
        }

        let token_client = token::Client::new(&env, &pool.token);
        token_client.transfer(
            &env.current_contract_address(),
            &recipient,
            &pool.current_funding_stroops,
        );

        pool.status = PoolStatus::Withdrawn;

        env.storage().persistent().set(&pool_key, &pool);
        env.storage()
            .persistent()
            .extend_ttl(&pool_key, LEDGER_THRESHOLD, LEDGER_EXTEND_TO);

        Ok(pool)
    }

    /// Resolves dispute with split
    pub fn resolve_dispute(
        env: Env,
        reservation_id: u64,
        arbiter: Address,
        producer_amount: i128,
        consumer_amount: i128,
    ) -> Result<EnergyReservation, SunshareError> {
        arbiter.require_auth();

        let res_key = DataKey::Reservation(reservation_id);
        let mut reservation: EnergyReservation = env
            .storage()
            .persistent()
            .get(&res_key)
            .ok_or(SunshareError::ReservationNotFound)?;

        let total_split = producer_amount
            .checked_add(consumer_amount)
            .ok_or(SunshareError::ArithmeticOverflow)?;

        if total_split != reservation.total_deposit_stroops {
            return Err(SunshareError::InvalidSplit);
        }

        let token_client = token::Client::new(&env, &reservation.token);

        if producer_amount > 0 {
            token_client.transfer(
                &env.current_contract_address(),
                &reservation.producer,
                &producer_amount,
            );
        }

        if consumer_amount > 0 {
            token_client.transfer(
                &env.current_contract_address(),
                &reservation.consumer,
                &consumer_amount,
            );
        }

        reservation.status = ReservationStatus::Disputed;
        reservation.settled_at = env.ledger().timestamp();

        env.storage().persistent().set(&res_key, &reservation);
        env.storage()
            .persistent()
            .extend_ttl(&res_key, LEDGER_THRESHOLD, LEDGER_EXTEND_TO);

        emit_dispute_resolved(&env, reservation_id, producer_amount, consumer_amount);

        Ok(reservation)
    }

    /// Query offer details
    pub fn get_offer(env: Env, offer_id: u64) -> Result<EnergyOffer, SunshareError> {
        let key = DataKey::Offer(offer_id);
        env.storage()
            .persistent()
            .get(&key)
            .ok_or(SunshareError::OfferNotFound)
    }

    /// Query reservation details
    pub fn get_reservation(env: Env, reservation_id: u64) -> Result<EnergyReservation, SunshareError> {
        let key = DataKey::Reservation(reservation_id);
        env.storage()
            .persistent()
            .get(&key)
            .ok_or(SunshareError::ReservationNotFound)
    }

    /// Query community pool details
    pub fn get_pool(env: Env, pool_id: u64) -> Result<CommunityPool, SunshareError> {
        let key = DataKey::Pool(pool_id);
        env.storage()
            .persistent()
            .get(&key)
            .ok_or(SunshareError::PoolNotFound)
    }

    /// Query producer reputation
    pub fn get_reputation(env: Env, producer: Address) -> ProducerReputation {
        let key = DataKey::Reputation(producer);
        env.storage()
            .persistent()
            .get(&key)
            .unwrap_or(ProducerReputation {
                total_delivered_kwh: 0,
                successful_deliveries: 0,
                disputes_count: 0,
            })
    }
}

#[cfg(test)]
mod test;
