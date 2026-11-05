import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query, withWallet } from '../db.js';
import { authenticateWallet, optionalWallet } from '../auth.js';
import { config } from '../config.js';

export const offersRouter = Router();

const createOfferSchema = z.object({
  on_chain_offer_id: z.coerce.bigint(),
  token_address: z.string().default(config.stellar.contractId),
  total_capacity_kwh: z.number().positive(),
  price_per_kwh_xlm: z.number().positive(),
  window_start: z.string().datetime(),
  window_end: z.string().datetime(),
  zone_id: z.string().min(1),
  meter_pubkey: z.string().min(1),
  tx_hash: z.string().optional(),
});

/**
 * List energy offers (filterable by zone, status, or producer)
 */
offersRouter.get('/', optionalWallet, async (req: Request, res: Response) => {
  try {
    const { zone, status = 'active', producer } = req.query;

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (status && status !== 'all') {
      conditions.push(`o.status = $${idx++}`);
      values.push(status);
    }
    if (zone) {
      conditions.push(`o.zone_id = $${idx++}`);
      values.push(zone);
    }
    if (producer) {
      conditions.push(`o.producer_wallet = $${idx++}`);
      values.push(producer);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT 
        o.*,
        p.display_name AS producer_name,
        p.reputation_score,
        p.successful_deliveries,
        p.solar_capacity_kw
      FROM energy_offers o
      JOIN profiles p ON o.producer_wallet = p.wallet_address
      ${whereClause}
      ORDER BY o.created_at DESC
    `;

    const result = await query(sql, values);
    res.json({ offers: result.rows });
  } catch (err) {
    console.error('List offers error:', err);
    res.status(500).json({ error: 'Failed to fetch energy offers' });
  }
});

/**
 * Get offer by ID
 */
offersRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const sql = `
      SELECT 
        o.*,
        p.display_name AS producer_name,
        p.reputation_score,
        p.successful_deliveries,
        p.solar_capacity_kw,
        p.battery_capacity_kwh
      FROM energy_offers o
      JOIN profiles p ON o.producer_wallet = p.wallet_address
      WHERE o.id = $1 OR o.on_chain_offer_id = $1
    `;
    const result = await query(sql, [id]);
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Energy offer not found' });
      return;
    }
    res.json({ offer: result.rows[0] });
  } catch (err) {
    console.error('Get offer error:', err);
    res.status(500).json({ error: 'Failed to fetch offer' });
  }
});

/**
 * Producer creates a new peer-to-peer energy offer
 */
offersRouter.post('/', authenticateWallet, async (req: Request, res: Response) => {
  try {
    const producerWallet = req.wallet!;
    const parseResult = createOfferSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Invalid offer data', details: parseResult.error.format() });
      return;
    }

    const data = parseResult.data;
    const priceStroops = Math.round(data.price_per_kwh_xlm * config.stellar.stroopsPerXlm);

    const newOffer = await withWallet(producerWallet, async (client) => {
      const result = await client.query(
        `INSERT INTO energy_offers (
          on_chain_offer_id, producer_wallet, token_address, total_capacity_kwh,
          available_capacity_kwh, price_per_kwh_xlm, price_per_kwh_stroops,
          window_start, window_end, zone_id, meter_pubkey, status, tx_hash
        ) VALUES (
          $1, $2, $3, $4, $4, $5, $6, $7, $8, $9, $10, 'active', $11
        ) RETURNING *`,
        [
          data.on_chain_offer_id.toString(),
          producerWallet,
          data.token_address,
          data.total_capacity_kwh,
          data.price_per_kwh_xlm,
          priceStroops,
          data.window_start,
          data.window_end,
          data.zone_id,
          data.meter_pubkey,
          data.tx_hash || null,
        ]
      );
      return result.rows[0];
    });

    // Record transaction log if tx_hash provided
    if (data.tx_hash) {
      await query(
        `INSERT INTO transactions (tx_hash, sender_wallet, tx_type, amount_xlm, metadata)
         VALUES ($1, $2, 'offer_created', 0, $3)
         ON CONFLICT (tx_hash) DO NOTHING`,
        [
          data.tx_hash,
          producerWallet,
          JSON.stringify({ offer_id: newOffer.id, capacity_kwh: data.total_capacity_kwh }),
        ]
      );
    }

    res.status(201).json({ offer: newOffer });
  } catch (err: any) {
    console.error('Create offer error:', err);
    res.status(500).json({ error: err.message || 'Failed to create energy offer' });
  }
});
