-- SUNSHARE P2P Energy Exchange - Initial Schema
-- Migration 001: Initial Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles: producers, consumers, and prosumers
CREATE TABLE IF NOT EXISTS profiles (
    wallet_address TEXT PRIMARY KEY,
    role TEXT NOT NULL DEFAULT 'consumer' CHECK (role IN ('producer', 'consumer', 'prosumer', 'admin')),
    display_name TEXT,
    zone_id TEXT NOT NULL DEFAULT 'ZONE_A',
    solar_capacity_kw NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    battery_capacity_kwh NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    meter_pubkey TEXT,
    avatar_seed TEXT,
    reputation_score INT NOT NULL DEFAULT 100,
    total_delivered_kwh NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    successful_deliveries INT NOT NULL DEFAULT 0,
    disputes_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Wallet Authentication Sessions
CREATE TABLE IF NOT EXISTS wallet_sessions (
    session_token TEXT PRIMARY KEY,
    wallet_address TEXT NOT NULL REFERENCES profiles(wallet_address) ON DELETE CASCADE,
    challenge_nonce TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Energy Offers published by producers
CREATE TABLE IF NOT EXISTS energy_offers (
    id BIGSERIAL PRIMARY KEY,
    on_chain_offer_id BIGINT UNIQUE,
    producer_wallet TEXT NOT NULL REFERENCES profiles(wallet_address) ON DELETE CASCADE,
    token_address TEXT NOT NULL,
    total_capacity_kwh NUMERIC(12, 2) NOT NULL,
    available_capacity_kwh NUMERIC(12, 2) NOT NULL,
    price_per_kwh_xlm NUMERIC(14, 7) NOT NULL,
    price_per_kwh_stroops BIGINT NOT NULL,
    window_start TIMESTAMPTZ NOT NULL,
    window_end TIMESTAMPTZ NOT NULL,
    zone_id TEXT NOT NULL,
    meter_pubkey TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
    tx_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Energy Reservations locked by consumers
CREATE TABLE IF NOT EXISTS reservations (
    id BIGSERIAL PRIMARY KEY,
    on_chain_res_id BIGINT UNIQUE,
    offer_id BIGINT NOT NULL REFERENCES energy_offers(id) ON DELETE CASCADE,
    producer_wallet TEXT NOT NULL REFERENCES profiles(wallet_address) ON DELETE CASCADE,
    consumer_wallet TEXT NOT NULL REFERENCES profiles(wallet_address) ON DELETE CASCADE,
    kwh_reserved NUMERIC(12, 2) NOT NULL,
    total_deposit_xlm NUMERIC(14, 7) NOT NULL,
    total_deposit_stroops BIGINT NOT NULL,
    delivered_kwh NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'delivered', 'expired', 'disputed', 'refunded')),
    expiry_timestamp TIMESTAMPTZ NOT NULL,
    settled_at TIMESTAMPTZ,
    lock_tx_hash TEXT,
    settle_tx_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Smart Meter Readings & Cryptographic Delivery Proofs
CREATE TABLE IF NOT EXISTS meter_readings (
    id BIGSERIAL PRIMARY KEY,
    reservation_id BIGINT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    meter_pubkey TEXT NOT NULL,
    kwh_delivered NUMERIC(12, 2) NOT NULL,
    meter_timestamp TIMESTAMPTZ NOT NULL,
    nonce TEXT NOT NULL UNIQUE,
    signature TEXT NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_simulated BOOLEAN NOT NULL DEFAULT FALSE,
    raw_payload_hex TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Community Energy Pools for joint funding
CREATE TABLE IF NOT EXISTS community_pools (
    id BIGSERIAL PRIMARY KEY,
    on_chain_pool_id BIGINT UNIQUE,
    creator_wallet TEXT NOT NULL REFERENCES profiles(wallet_address) ON DELETE CASCADE,
    token_address TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    target_funding_xlm NUMERIC(14, 7) NOT NULL,
    target_funding_stroops BIGINT NOT NULL,
    current_funding_xlm NUMERIC(14, 7) NOT NULL DEFAULT 0.00,
    current_funding_stroops BIGINT NOT NULL DEFAULT 0,
    deadline TIMESTAMPTZ NOT NULL,
    zone_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'funding' CHECK (status IN ('funding', 'goal_reached', 'withdrawn', 'refunded')),
    recipient_address TEXT,
    tx_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pool Contributions
CREATE TABLE IF NOT EXISTS pool_contributions (
    id BIGSERIAL PRIMARY KEY,
    pool_id BIGINT NOT NULL REFERENCES community_pools(id) ON DELETE CASCADE,
    contributor_wallet TEXT NOT NULL REFERENCES profiles(wallet_address) ON DELETE CASCADE,
    amount_xlm NUMERIC(14, 7) NOT NULL,
    amount_stroops BIGINT NOT NULL,
    tx_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- On-Chain & Platform Transactions
CREATE TABLE IF NOT EXISTS transactions (
    id BIGSERIAL PRIMARY KEY,
    tx_hash TEXT NOT NULL UNIQUE,
    sender_wallet TEXT NOT NULL,
    recipient_wallet TEXT,
    tx_type TEXT NOT NULL CHECK (tx_type IN (
        'offer_created', 'reservation_locked', 'meter_settlement',
        'reservation_refunded', 'pool_contribution', 'pool_withdrawal', 'dispute_resolved'
    )),
    amount_xlm NUMERIC(14, 7) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'failed')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    recipient_wallet TEXT NOT NULL REFERENCES profiles(wallet_address) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
    read BOOLEAN NOT NULL DEFAULT FALSE,
    link TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reputation Ledger
CREATE TABLE IF NOT EXISTS reputation_events (
    id BIGSERIAL PRIMARY KEY,
    producer_wallet TEXT NOT NULL REFERENCES profiles(wallet_address) ON DELETE CASCADE,
    reservation_id BIGINT REFERENCES reservations(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('delivery_success', 'partial_delivery', 'dispute', 'pool_completion')),
    kwh_impact NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    score_delta INT NOT NULL DEFAULT 0,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for lightning fast lookups
CREATE INDEX IF NOT EXISTS idx_offers_status_zone ON energy_offers(status, zone_id);
CREATE INDEX IF NOT EXISTS idx_offers_producer ON energy_offers(producer_wallet);
CREATE INDEX IF NOT EXISTS idx_reservations_consumer ON reservations(consumer_wallet);
CREATE INDEX IF NOT EXISTS idx_reservations_producer ON reservations(producer_wallet);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_pools_zone_status ON community_pools(zone_id, status);
CREATE INDEX IF NOT EXISTS idx_pool_contribs_pool ON pool_contributions(pool_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_wallet, read);
CREATE INDEX IF NOT EXISTS idx_transactions_sender ON transactions(sender_wallet);

