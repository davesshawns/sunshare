import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query, withWallet } from '../db.js';
import { authenticateWallet } from '../auth.js';
import { config } from '../config.js';

export const reservationsRouter = Router();

const createReservationSchema = z.object({
  on_chain_res_id: z.coerce.bigint(),
  offer_id: z.coerce.bigint(),
  kwh_reserved: z.number().positive(),
  total_deposit_xlm: z.number().positive(),
  expiry_timestamp: z.string().datetime(),
  lock_tx_hash: z.string().optional(),
});

/**
 * List reservations for current authenticated wallet (producer or consumer)
 */
reservationsRouter.get('/', authenticateWallet, async (req: Request, res: Response) => {
  try {
    const wallet = req.wallet!;
    const { role } = req.query; // 'consumer' | 'producer' | undefined

    let filterClause = `(r.consumer_wallet = $1 OR r.producer_wallet = $1)`;
    if (role === 'consumer') {
      filterClause = `r.consumer_wallet = $1`;
    } else if (role === 'producer') {
      filterClause = `r.producer_wallet = $1`;
    }

    const sql = `
      SELECT 
        r.*,
        o.zone_id,
        o.price_per_kwh_xlm,
        o.window_start,
        o.window_end,
        p_prod.display_name AS producer_name,
        p_cons.display_name AS consumer_name
      FROM reservations r
      JOIN energy_offers o ON r.offer_id = o.id
      JOIN profiles p_prod ON r.producer_wallet = p_prod.wallet_address
      JOIN profiles p_cons ON r.consumer_wallet = p_cons.wallet_address
      WHERE ${filterClause}
      ORDER BY r.created_at DESC
    `;

    const result = await withWallet(wallet, async (client) => {
      return client.query(sql, [wallet]);
    });

    res.json({ reservations: result.rows });
  } catch (err) {
    console.error('List reservations error:', err);
    res.status(500).json({ error: 'Failed to fetch reservations' });
  }
});

/**
 * Get reservation details with associated meter reading proofs
 */
reservationsRouter.get('/:id', authenticateWallet, async (req: Request, res: Response) => {
  try {
    const wallet = req.wallet!;
    const { id } = req.params;

    const sql = `
      SELECT 
        r.*,
        o.zone_id,
        o.price_per_kwh_xlm,
        o.meter_pubkey,
        o.window_start,
        o.window_end,
        p_prod.display_name AS producer_name,
        p_cons.display_name AS consumer_name
      FROM reservations r
      JOIN energy_offers o ON r.offer_id = o.id
      JOIN profiles p_prod ON r.producer_wallet = p_prod.wallet_address
      JOIN profiles p_cons ON r.consumer_wallet = p_cons.wallet_address
      WHERE (r.id = $1 OR r.on_chain_res_id = $1)
      AND (r.consumer_wallet = $2 OR r.producer_wallet = $2)
    `;

    const result = await withWallet(wallet, async (client) => {
      return client.query(sql, [id, wallet]);
    });

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Reservation not found or unauthorized' });
      return;
    }

    const reservation = result.rows[0];

    // Fetch meter readings for this reservation
    const readings = await query(
      `SELECT * FROM meter_readings WHERE reservation_id = $1 ORDER BY meter_timestamp DESC`,
      [reservation.id]
    );

    res.json({
      reservation,
      readings: readings.rows,
    });
  } catch (err) {
    console.error('Get reservation error:', err);
    res.status(500).json({ error: 'Failed to fetch reservation' });
  }
});

/**
 * Consumer locks an energy reservation from an active offer
 */
reservationsRouter.post('/', authenticateWallet, async (req: Request, res: Response) => {
  try {
    const consumerWallet = req.wallet!;
    const parseResult = createReservationSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Invalid reservation request', details: parseResult.error.format() });
      return;
    }

    const data = parseResult.data;
    const totalStroops = Math.round(data.total_deposit_xlm * config.stellar.stroopsPerXlm);

    const reservation = await withWallet(consumerWallet, async (client) => {
      // 1. Fetch offer and ensure sufficient capacity
      const offerRes = await client.query(
        `SELECT * FROM energy_offers WHERE id = $1 FOR UPDATE`,
        [data.offer_id.toString()]
      );

      if (offerRes.rowCount === 0) {
        throw new Error('Offer not found');
      }

      const offer = offerRes.rows[0];
      if (offer.status !== 'active') {
        throw new Error('Offer is no longer active');
      }

      if (parseFloat(offer.available_capacity_kwh) < data.kwh_reserved) {
        throw new Error('Requested capacity exceeds available energy offer');
      }

      // 2. Insert reservation
      const newRes = await client.query(
        `INSERT INTO reservations (
          on_chain_res_id, offer_id, producer_wallet, consumer_wallet,
          kwh_reserved, total_deposit_xlm, total_deposit_stroops,
          status, expiry_timestamp, lock_tx_hash
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, 'locked', $8, $9
        ) RETURNING *`,
        [
          data.on_chain_res_id.toString(),
          offer.id,
          offer.producer_wallet,
          consumerWallet,
          data.kwh_reserved,
          data.total_deposit_xlm,
          totalStroops,
          data.expiry_timestamp,
          data.lock_tx_hash || null,
        ]
      );

      // 3. Deduct available capacity from offer
      const newAvail = parseFloat(offer.available_capacity_kwh) - data.kwh_reserved;
      const newStatus = newAvail <= 0 ? 'completed' : 'active';
      await client.query(
        `UPDATE energy_offers
         SET available_capacity_kwh = $1, status = $2, updated_at = NOW()
         WHERE id = $3`,
        [newAvail, newStatus, offer.id]
      );

      // 4. Send notification to producer
      await client.query(
        `INSERT INTO notifications (recipient_wallet, title, message, type, link)
         VALUES ($1, $2, $3, 'info', $4)`,
        [
          offer.producer_wallet,
          'New Energy Reservation',
          `${data.kwh_reserved} kWh reserved by ${consumerWallet.slice(0, 4)}...${consumerWallet.slice(-4)}. Escrow locked: ${data.total_deposit_xlm} XLM.`,
          `/reservations/${newRes.rows[0].id}`,
        ]
      );

      return newRes.rows[0];
    });

    if (data.lock_tx_hash) {
      await query(
        `INSERT INTO transactions (tx_hash, sender_wallet, recipient_wallet, tx_type, amount_xlm, metadata)
         VALUES ($1, $2, $3, 'reservation_locked', $4, $5)
         ON CONFLICT (tx_hash) DO NOTHING`,
        [
          data.lock_tx_hash,
          consumerWallet,
          reservation.producer_wallet,
          data.total_deposit_xlm,
          JSON.stringify({ reservation_id: reservation.id }),
        ]
      );
    }

    res.status(201).json({ reservation });
  } catch (err: any) {
    console.error('Create reservation error:', err);
    res.status(400).json({ error: err.message || 'Failed to create reservation' });
  }
});

