-- SUNSHARE Seed Data for Development / Testing

-- 1. Profiles
INSERT INTO profiles (wallet_address, role, display_name, zone_id, solar_capacity_kw, battery_capacity_kwh, meter_pubkey, reputation_score, total_delivered_kwh, successful_deliveries)
VALUES 
(
  'GDEMOWALLET77777777777777777777777777777777777777777777777',
  'prosumer',
  'Solar Pioneer Sunny',
  'ZONE_A',
  15.00,
  24.00,
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  420,
  1250.00,
  38
),
(
  'GPRODUCER1111111111111111111111111111111111111111111111111',
  'producer',
  'Helios Microgrid Farm',
  'ZONE_A',
  40.00,
  60.00,
  'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
  890,
  4500.00,
  112
),
(
  'GPRODUCER2222222222222222222222222222222222222222222222222',
  'producer',
  'Apex Rooftop Solar',
  'ZONE_B',
  25.00,
  32.00,
  'f0e1d2c3b4a5968778695a4b3c2d1e0f0123456789abcdef0123456789abcdef',
  750,
  2800.00,
  74
)
ON CONFLICT (wallet_address) DO UPDATE
SET display_name = EXCLUDED.display_name,
    solar_capacity_kw = EXCLUDED.solar_capacity_kw,
    battery_capacity_kwh = EXCLUDED.battery_capacity_kwh;

-- 2. Energy Offers
INSERT INTO energy_offers (
  on_chain_offer_id, producer_wallet, token_address, total_capacity_kwh,
  available_capacity_kwh, price_per_kwh_xlm, price_per_kwh_stroops,
  window_start, window_end, zone_id, meter_pubkey, status
)
VALUES
(
  101,
  'GPRODUCER1111111111111111111111111111111111111111111111111',
  'CBZ3D74BRL6T74X35E2RHK3F4EQH2Z5T6KLRB62E3K4PY7W2X6EEXAMPLE',
  150.00,
  110.00,
  0.4200000,
  4200000,
  NOW() - INTERVAL '2 hours',
  NOW() + INTERVAL '22 hours',
  'ZONE_A',
  'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
  'active'
),
(
  102,
  'GPRODUCER2222222222222222222222222222222222222222222222222',
  'CBZ3D74BRL6T74X35E2RHK3F4EQH2Z5T6KLRB62E3K4PY7W2X6EEXAMPLE',
  80.00,
  65.00,
  0.4800000,
  4800000,
  NOW() - INTERVAL '1 hour',
  NOW() + INTERVAL '23 hours',
  'ZONE_B',
  'f0e1d2c3b4a5968778695a4b3c2d1e0f0123456789abcdef0123456789abcdef',
  'active'
),
(
  103,
  'GDEMOWALLET77777777777777777777777777777777777777777777777',
  'CBZ3D74BRL6T74X35E2RHK3F4EQH2Z5T6KLRB62E3K4PY7W2X6EEXAMPLE',
  100.00,
  100.00,
  0.4500000,
  4500000,
  NOW(),
  NOW() + INTERVAL '48 hours',
  'ZONE_SOLAR_1',
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  'active'
)
ON CONFLICT (on_chain_offer_id) DO NOTHING;

-- 3. Community Energy Pools
INSERT INTO community_pools (
  on_chain_pool_id, creator_wallet, token_address, title, description,
  target_funding_xlm, target_funding_stroops, current_funding_xlm, current_funding_stroops,
  deadline, zone_id, status
)
VALUES
(
  501,
  'GPRODUCER1111111111111111111111111111111111111111111111111',
  'CBZ3D74BRL6T74X35E2RHK3F4EQH2Z5T6KLRB62E3K4PY7W2X6EEXAMPLE',
  'North Zone Microgrid 100kWh Battery Storage',
  'Shared community battery storage to absorb midday peak solar generation and provide backup power during grid blackouts.',
  500.00,
  5000000000,
  380.00,
  3800000000,
  NOW() + INTERVAL '25 days',
  'ZONE_A',
  'funding'
),
(
  502,
  'GPRODUCER2222222222222222222222222222222222222222222222222',
  'CBZ3D74BRL6T74X35E2RHK3F4EQH2Z5T6KLRB62E3K4PY7W2X6EEXAMPLE',
  'Sunny Heights Solar School Canopy',
  'Solar canopy over the community school parking lot, providing 30kW clean power and EV charging stations for local residents.',
  750.00,
  7500000000,
  750.00,
  7500000000,
  NOW() + INTERVAL '10 days',
  'ZONE_SOLAR_1',
  'goal_reached'
)
ON CONFLICT (on_chain_pool_id) DO NOTHING;

-- 4. Initial Notification for Demo User
INSERT INTO notifications (recipient_wallet, title, message, type, link)
VALUES
(
  'GDEMOWALLET77777777777777777777777777777777777777777777777',
  'Welcome to SUNSHARE P2P Energy Exchange',
  'Your solar prosumer node is online. 15 kW PV array connected to ZONE_A microgrid. Stellar Soroban escrow ready.',
  'info',
  '/'
);
