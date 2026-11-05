import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Keypair } from '@stellar/stellar-sdk';
import { query, withWallet } from '../db.js';
import { authenticateWallet, optionalWallet } from '../auth.js';
import {
  generateNonce,
  buildMeterPayloadHash,
  verifyMeterSignature,
} from '../stellar.js';

export const metersRouter = Router();

const submitReadingSchema = z.object({
  reservation_id: z.coerce.bigint(),
  kwh_delivered: z.number().positive(),
  meter_timestamp: z.string().datetime(),
  nonce: z.string().length(64), // 32 bytes hex
  signature: z.string().min(64), // hex string of 64-byte Ed25519 signature
  meter_pubkey: z.string().min(32),
  is_simulated: z.boolean().default(false),
  settle_tx_hash: z.string().optional(),
});

/**
 * Verify and record a signed smart meter reading
 */
metersRouter.post('/readings', authenticateWallet, async (req: Request, res: Response) => {
  try {
    const callerWallet = req.wallet!;
    const parseResult = submitReadingSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Invalid meter reading payload',
        details: parseResult.error.format(),
      });
      return;
    }

    const data = parseResult.data;

    // Check nonce uniqueness (replay attack prevention)
    const existingNonce = await query(
      `SELECT id FROM meter_readings WHERE nonce = $1`,
      [data.nonce]
    );
    if (existingNonce.rowCount && existingNonce.rowCount > 0) {
      res.status(409).json({ error: 'Replay detected: this meter reading nonce has already been used' });
      return;
    }

    // Fetch reservation details
    const resResult = await query(
      `SELECT r.*, o.meter_pubkey AS expected_pubkey, o.price_per_kwh_xlm
       FROM reservations r
       JOIN energy_offers o ON r.offer_id = o.id
       WHERE r.id = $1 OR r.on_chain_res_id = $1`,
      [data.reservation_id.toString()]
    );

    if (resResult.rowCount === 0) {
      res.status(404).json({ error: 'Reservation not found' });
      return;
    }

    const reservation = resResult.rows[0];

    // Caller must be producer or consumer of this reservation
    if (callerWallet !== reservation.producer_wallet && callerWallet !== reservation.consumer_wallet) {
      res.status(403).json({ error: 'Unauthorized to submit readings for this reservation' });
      return;
    }

    if (reservation.status !== 'locked') {
      res.status(400).json({ error: `Reservation is already in '${reservation.status}' state` });
      return;
    }

    const tsUnixSeconds = Math.floor(new Date(data.meter_timestamp).getTime() / 1000);

    // Cryptographic Ed25519 signature verification
    const isValidSignature = verifyMeterSignature({
      reservationId: reservation.on_chain_res_id || reservation.id,
      kwhDelivered: Math.round(data.kwh_delivered),
      meterTimestamp: tsUnixSeconds,
      nonceHex: data.nonce,
      signatureHex: data.signature,
      meterPubkey: data.meter_pubkey,
    });

    if (!isValidSignature) {
      res.status(422).json({
        error: 'Cryptographic signature verification failed: meter reading signature did not match public key',
      });
      return;
    }

    // Settle delivery in database transaction
    const effectiveKwh = Math.min(data.kwh_delivered, parseFloat(reservation.kwh_reserved));
    const payoutXlm = effectiveKwh * parseFloat(reservation.price_per_kwh_xlm);
    const refundXlm = parseFloat(reservation.total_deposit_xlm) - payoutXlm;

    const savedReading = await withWallet(callerWallet, async (client) => {
      // 1. Insert meter reading
      const rRecord = await client.query(
        `INSERT INTO meter_readings (
          reservation_id, meter_pubkey, kwh_delivered, meter_timestamp,
          nonce, signature, is_verified, is_simulated
        ) VALUES (
          $1, $2, $3, $4, $5, $6, true, $7
        ) RETURNING *`,
        [
          reservation.id,
          data.meter_pubkey,
          data.kwh_delivered,
          data.meter_timestamp,
          data.nonce,
          data.signature,
          data.is_simulated,
        ]
      );

      // 2. Mark reservation delivered and settled
      await client.query(
        `UPDATE reservations
         SET status = 'delivered', delivered_kwh = $1, settled_at = NOW(),
             settle_tx_hash = $2, updated_at = NOW()
         WHERE id = $3`,
        [effectiveKwh, data.settle_tx_hash || null, reservation.id]
      );

      // 3. Update producer profile stats & reputation score (+5 per delivery)
      await client.query(
        `UPDATE profiles
         SET total_delivered_kwh = total_delivered_kwh + $1,
             successful_deliveries = successful_deliveries + 1,
             reputation_score = LEAST(reputation_score + 5, 1000),
             updated_at = NOW()
         WHERE wallet_address = $2`,
        [effectiveKwh, reservation.producer_wallet]
      );

      // 4. Record reputation event
      await client.query(
        `INSERT INTO reputation_events (
          producer_wallet, reservation_id, event_type, kwh_impact, score_delta, description
        ) VALUES (
          $1, $2, 'delivery_success', $3, 5, $4
        )`,
        [
          reservation.producer_wallet,
          reservation.id,
          effectiveKwh,
          `Successful delivery of ${effectiveKwh} kWh via verified smart meter`,
        ]
      );

      // 5. Notify consumer of delivery and refund if any
      await client.query(
        `INSERT INTO notifications (recipient_wallet, title, message, type, link)
         VALUES ($1, $2, $3, 'success', $4)`,
        [
          reservation.consumer_wallet,
          'Energy Delivered & Escrow Settled',
          `Smart meter verified delivery of ${effectiveKwh} kWh. Payout: ${payoutXlm.toFixed(4)} XLM.${refundXlm > 0 ? ` Refund: ${refundXlm.toFixed(4)} XLM.` : ''}`,
          `/reservations/${reservation.id}`,
        ]
      );

      return rRecord.rows[0];
    });

    res.status(201).json({
      reading: savedReading,
      settlement: {
        effectiveKwh,
        payoutXlm,
        refundXlm,
        producerWallet: reservation.producer_wallet,
        consumerWallet: reservation.consumer_wallet,
      },
    });
  } catch (err: any) {
    console.error('Submit reading error:', err);
    res.status(500).json({ error: err.message || 'Failed to submit meter reading' });
  }
});

/**
 * Simulator helper: generates a realistic signed meter reading for demonstration and testing.
 * All readings from this tool have `is_simulated = true` clearly tagged.
 */
metersRouter.get('/simulate-payload', optionalWallet, async (req: Request, res: Response) => {
  try {
    const { reservation_id, kwh_delivered = 25 } = req.query;

    const resId = reservation_id ? BigInt(reservation_id as string) : 101n;
    const kwh = BigInt(Math.round(Number(kwh_delivered)));
    const nowUnix = BigInt(Math.floor(Date.now() / 1000));
    const nonceHex = generateNonce(32);

    // Generate ephemeral smart meter keypair
    const meterKeypair = Keypair.random();
    const meterPubkeyHex = meterKeypair.rawPublicKey().toString('hex');

    // Build canonical hash
    const hash = buildMeterPayloadHash(resId, kwh, nowUnix, nonceHex);
    const signature = meterKeypair.sign(hash);
    const signatureHex = signature.toString('hex');

    res.json({
      is_simulated: true,
      reservation_id: resId.toString(),
      kwh_delivered: Number(kwh),
      meter_timestamp: new Date(Number(nowUnix) * 1000).toISOString(),
      nonce: nonceHex,
      signature: signatureHex,
      meter_pubkey: meterPubkeyHex,
      stellar_public_key: meterKeypair.publicKey(),
      verification_status: 'valid_signature',
    });
  } catch (err) {
    console.error('Simulate payload error:', err);
    res.status(500).json({ error: 'Failed to simulate meter payload' });
  }
});
