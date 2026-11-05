import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { pool } from '../src/db.js';
import { Keypair } from '@stellar/stellar-sdk';
import { buildMeterPayloadHash, generateNonce } from '../src/stellar.js';

describe('SUNSHARE API End-to-End Suite', () => {
  let demoToken: string;
  const testWallet = 'GDEMOWALLET77777777777777777777777777777777777777777777777';

  beforeAll(async () => {
    // Clear test database tables
    await pool.query('DELETE FROM reputation_events');
    await pool.query('DELETE FROM meter_readings');
    await pool.query('DELETE FROM pool_contributions');
    await pool.query('DELETE FROM reservations');
    await pool.query('DELETE FROM energy_offers');
    await pool.query('DELETE FROM community_pools');
    await pool.query('DELETE FROM notifications');
    await pool.query('DELETE FROM transactions');
    await pool.query('DELETE FROM wallet_sessions');
    await pool.query('DELETE FROM profiles');
  });

  afterAll(async () => {
    await pool.end();
  });

  it('GET /health returns healthy status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.stellarNetwork).toBe('testnet');
  });

  it('POST /api/auth/demo issues a valid session', async () => {
    const res = await request(app)
      .post('/api/auth/demo')
      .send({ role: 'prosumer', wallet: testWallet });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.profile.wallet_address).toBe(testWallet);
    demoToken = res.body.token;
  });

  it('GET /api/auth/me returns authenticated profile', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${demoToken}`)
      .set('x-demo-wallet', testWallet);

    expect(res.status).toBe(200);
    expect(res.body.profile.wallet_address).toBe(testWallet);
  });

  it('PUT /api/profiles/me updates profile details', async () => {
    const res = await request(app)
      .put('/api/profiles/me')
      .set('Authorization', `Bearer ${demoToken}`)
      .set('x-demo-wallet', testWallet)
      .send({
        display_name: 'Solar Pioneer Sunny',
        solar_capacity_kw: 15.5,
        battery_capacity_kwh: 30.0,
        zone_id: 'ZONE_SOLAR_1',
      });

    expect(res.status).toBe(200);
    expect(res.body.profile.display_name).toBe('Solar Pioneer Sunny');
    expect(parseFloat(res.body.profile.solar_capacity_kw)).toBe(15.5);
  });

  let createdOfferId: string;
  let meterKeypair: Keypair;
  let meterPubkeyHex: string;

  it('POST /api/offers creates a new energy offer', async () => {
    meterKeypair = Keypair.random();
    meterPubkeyHex = meterKeypair.rawPublicKey().toString('hex');

    const res = await request(app)
      .post('/api/offers')
      .set('Authorization', `Bearer ${demoToken}`)
      .set('x-demo-wallet', testWallet)
      .send({
        on_chain_offer_id: '1001',
        total_capacity_kwh: 80,
        price_per_kwh_xlm: 0.5,
        window_start: new Date(Date.now() - 3600000).toISOString(),
        window_end: new Date(Date.now() + 86400000).toISOString(),
        zone_id: 'ZONE_SOLAR_1',
        meter_pubkey: meterPubkeyHex,
      });

    expect(res.status).toBe(201);
    expect(res.body.offer.id).toBeDefined();
    expect(parseFloat(res.body.offer.total_capacity_kwh)).toBe(80);
    expect(res.body.offer.producer_wallet).toBe(testWallet);
    createdOfferId = res.body.offer.id;
  });

  it('GET /api/offers returns the active offer', async () => {
    const res = await request(app).get('/api/offers');
    expect(res.status).toBe(200);
    expect(res.body.offers.length).toBeGreaterThan(0);
    expect(res.body.offers[0].zone_id).toBe('ZONE_SOLAR_1');
  });

  let createdReservationId: string;

  it('POST /api/reservations locks energy reservation and reduces capacity', async () => {
    const consumerWallet = 'GCONSUMER99999999999999999999999999999999999999999999999';
    const consumerToken = `demo_${consumerWallet}`;

    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${consumerToken}`)
      .set('x-demo-wallet', consumerWallet)
      .send({
        on_chain_res_id: '2001',
        offer_id: createdOfferId,
        kwh_reserved: 30,
        total_deposit_xlm: 15.0, // 30 * 0.5 XLM
        expiry_timestamp: new Date(Date.now() + 90000000).toISOString(),
      });

    expect(res.status).toBe(201);
    expect(res.body.reservation.status).toBe('locked');
    expect(parseFloat(res.body.reservation.kwh_reserved)).toBe(30);
    createdReservationId = res.body.reservation.id;

    // Check offer capacity decreased from 80 to 50
    const offerCheck = await request(app).get(`/api/offers/${createdOfferId}`);
    expect(parseFloat(offerCheck.body.offer.available_capacity_kwh)).toBe(50);
  });

  it('POST /api/meters/readings verifies Ed25519 signature and settles payment', async () => {
    const nowUnix = Math.floor(Date.now() / 1000);
    const nonceHex = generateNonce(32);
    const kwhDelivered = 30;

    // Smart meter cryptographically signs canonical payload
    const hash = buildMeterPayloadHash(2001n, BigInt(kwhDelivered), BigInt(nowUnix), nonceHex);
    const signature = meterKeypair.sign(hash).toString('hex');

    const res = await request(app)
      .post('/api/meters/readings')
      .set('Authorization', `Bearer ${demoToken}`)
      .set('x-demo-wallet', testWallet)
      .send({
        reservation_id: createdReservationId,
        kwh_delivered: kwhDelivered,
        meter_timestamp: new Date(nowUnix * 1000).toISOString(),
        nonce: nonceHex,
        signature: signature,
        meter_pubkey: meterPubkeyHex,
        is_simulated: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.reading.is_verified).toBe(true);
    expect(res.body.settlement.effectiveKwh).toBe(30);
    expect(res.body.settlement.payoutXlm).toBe(15.0);

    // Verify reservation status is now delivered
    const resCheck = await request(app)
      .get(`/api/reservations/${createdReservationId}`)
      .set('Authorization', `Bearer ${demoToken}`)
      .set('x-demo-wallet', testWallet);

    expect(resCheck.body.reservation.status).toBe('delivered');
    expect(parseFloat(resCheck.body.reservation.delivered_kwh)).toBe(30);
  });

  it('POST /api/meters/readings rejects replay attack with same nonce', async () => {
    const nowUnix = Math.floor(Date.now() / 1000);
    const nonceHex = generateNonce(32);
    const hash = buildMeterPayloadHash(2001n, 10n, BigInt(nowUnix), nonceHex);
    const signature = meterKeypair.sign(hash).toString('hex');

    // First attempt on new reservation or existing will fail or succeed; let's test nonce collision
    await pool.query(
      `INSERT INTO meter_readings (reservation_id, meter_pubkey, kwh_delivered, meter_timestamp, nonce, signature, is_verified)
       VALUES ($1, $2, 10, NOW(), $3, $4, true)`,
      [createdReservationId, meterPubkeyHex, nonceHex, signature]
    );

    const replayRes = await request(app)
      .post('/api/meters/readings')
      .set('Authorization', `Bearer ${demoToken}`)
      .set('x-demo-wallet', testWallet)
      .send({
        reservation_id: createdReservationId,
        kwh_delivered: 10,
        meter_timestamp: new Date(nowUnix * 1000).toISOString(),
        nonce: nonceHex,
        signature: signature,
        meter_pubkey: meterPubkeyHex,
      });

    expect(replayRes.status).toBe(409);
    expect(replayRes.body.error).toMatch(/Replay detected/i);
  });

  it('POST /api/pools and contribute lifecycle', async () => {
    const poolRes = await request(app)
      .post('/api/pools')
      .set('Authorization', `Bearer ${demoToken}`)
      .set('x-demo-wallet', testWallet)
      .send({
        on_chain_pool_id: '5001',
        title: 'Community Microgrid Battery Storage',
        description: 'Joint battery storage installation for Zone A solar resilience',
        target_funding_xlm: 100.0,
        deadline: new Date(Date.now() + 30 * 86400000).toISOString(),
        zone_id: 'ZONE_SOLAR_1',
      });

    expect(poolRes.status).toBe(201);
    const poolId = poolRes.body.pool.id;
    expect(poolRes.body.pool.status).toBe('funding');

    // Contribute 100 XLM
    const contribRes = await request(app)
      .post(`/api/pools/${poolId}/contribute`)
      .set('Authorization', `Bearer ${demoToken}`)
      .set('x-demo-wallet', testWallet)
      .send({ amount_xlm: 100.0 });

    expect(contribRes.status).toBe(200);
    expect(contribRes.body.pool.status).toBe('goal_reached');
    expect(parseFloat(contribRes.body.pool.current_funding_xlm)).toBe(100.0);
  });
});
