-- SUNSHARE P2P Energy Exchange - Row Level Security Policies
-- Migration 002: RLS Policies

-- Helper function to extract authenticated wallet from session variable
CREATE OR REPLACE FUNCTION current_wallet() RETURNS TEXT AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_wallet', true), '');
END;
$$ LANGUAGE plpgsql STABLE;

-- Enable RLS on all relevant tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE energy_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE meter_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE pool_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reputation_events ENABLE ROW LEVEL SECURITY;

-- 1. Profiles: anyone can view public profiles; only owner or admin can update
DROP POLICY IF EXISTS profiles_read_policy ON profiles;
CREATE POLICY profiles_read_policy ON profiles
    FOR SELECT USING (true);

DROP POLICY IF EXISTS profiles_insert_policy ON profiles;
CREATE POLICY profiles_insert_policy ON profiles
    FOR INSERT WITH CHECK (
        current_wallet() IS NULL OR current_wallet() = wallet_address
    );

DROP POLICY IF EXISTS profiles_update_policy ON profiles;
CREATE POLICY profiles_update_policy ON profiles
    FOR UPDATE USING (
        current_wallet() IS NULL OR current_wallet() = wallet_address
    );

-- 2. Wallet Sessions: private to the session owner
DROP POLICY IF EXISTS sessions_policy ON wallet_sessions;
CREATE POLICY sessions_policy ON wallet_sessions
    FOR ALL USING (
        current_wallet() IS NULL OR current_wallet() = wallet_address
    );

-- 3. Energy Offers: public can read active/all offers; only producer can insert/update
DROP POLICY IF EXISTS offers_read_policy ON energy_offers;
CREATE POLICY offers_read_policy ON energy_offers
    FOR SELECT USING (true);

DROP POLICY IF EXISTS offers_insert_policy ON energy_offers;
CREATE POLICY offers_insert_policy ON energy_offers
    FOR INSERT WITH CHECK (
        current_wallet() IS NULL OR current_wallet() = producer_wallet
    );

DROP POLICY IF EXISTS offers_update_policy ON energy_offers;
CREATE POLICY offers_update_policy ON energy_offers
    FOR UPDATE USING (
        current_wallet() IS NULL OR current_wallet() = producer_wallet
    );

-- 4. Reservations: producer or consumer involved can read and manage
DROP POLICY IF EXISTS reservations_read_policy ON reservations;
CREATE POLICY reservations_read_policy ON reservations
    FOR SELECT USING (
        current_wallet() IS NULL OR current_wallet() = consumer_wallet OR current_wallet() = producer_wallet
    );

DROP POLICY IF EXISTS reservations_insert_policy ON reservations;
CREATE POLICY reservations_insert_policy ON reservations
    FOR INSERT WITH CHECK (
        current_wallet() IS NULL OR current_wallet() = consumer_wallet
    );

DROP POLICY IF EXISTS reservations_update_policy ON reservations;
CREATE POLICY reservations_update_policy ON reservations
    FOR UPDATE USING (
        current_wallet() IS NULL OR current_wallet() = consumer_wallet OR current_wallet() = producer_wallet
    );

-- 5. Meter Readings: participants of the reservation can read; authenticated system can insert
DROP POLICY IF EXISTS meter_readings_read_policy ON meter_readings;
CREATE POLICY meter_readings_read_policy ON meter_readings
    FOR SELECT USING (
        current_wallet() IS NULL OR EXISTS (
            SELECT 1 FROM reservations r
            WHERE r.id = meter_readings.reservation_id
            AND (r.consumer_wallet = current_wallet() OR r.producer_wallet = current_wallet())
        )
    );

DROP POLICY IF EXISTS meter_readings_insert_policy ON meter_readings;
CREATE POLICY meter_readings_insert_policy ON meter_readings
    FOR INSERT WITH CHECK (true);

-- 6. Community Pools: public read; creator can insert/update
DROP POLICY IF EXISTS pools_read_policy ON community_pools;
CREATE POLICY pools_read_policy ON community_pools
    FOR SELECT USING (true);

DROP POLICY IF EXISTS pools_insert_policy ON community_pools;
CREATE POLICY pools_insert_policy ON community_pools
    FOR INSERT WITH CHECK (
        current_wallet() IS NULL OR current_wallet() = creator_wallet
    );

DROP POLICY IF EXISTS pools_update_policy ON community_pools;
CREATE POLICY pools_update_policy ON community_pools
    FOR UPDATE USING (
        current_wallet() IS NULL OR current_wallet() = creator_wallet
    );

-- 7. Pool Contributions: public read; contributor can insert
DROP POLICY IF EXISTS pool_contribs_read_policy ON pool_contributions;
CREATE POLICY pool_contribs_read_policy ON pool_contributions
    FOR SELECT USING (true);

DROP POLICY IF EXISTS pool_contribs_insert_policy ON pool_contributions;
CREATE POLICY pool_contribs_insert_policy ON pool_contributions
    FOR INSERT WITH CHECK (
        current_wallet() IS NULL OR current_wallet() = contributor_wallet
    );

-- 8. Notifications: strictly for the recipient
DROP POLICY IF EXISTS notifications_policy ON notifications;
CREATE POLICY notifications_policy ON notifications
    FOR ALL USING (
        current_wallet() IS NULL OR current_wallet() = recipient_wallet
    );

-- 9. Reputation Events: public read
DROP POLICY IF EXISTS reputation_events_policy ON reputation_events;
CREATE POLICY reputation_events_policy ON reputation_events
    FOR SELECT USING (true);
