import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { authenticateWallet } from '../auth.js';

export const transactionsRouter = Router();

const createTxSchema = z.object({
  tx_hash: z.string().min(1),
  recipient_wallet: z.string().optional(),
  tx_type: z.enum([
    'offer_created',
    'reservation_locked',
    'meter_settlement',
    'reservation_refunded',
    'pool_contribution',
    'pool_withdrawal',
    'dispute_resolved',
  ]),
  amount_xlm: z.number().default(0),
  status: z.enum(['pending', 'confirmed', 'failed']).default('confirmed'),
  metadata: z.record(z.any()).default({}),
});

/**
 * List transactions for authenticated wallet
 */
transactionsRouter.get('/', authenticateWallet, async (req: Request, res: Response) => {
  try {
    const wallet = req.wallet!;
    const result = await query(
      `SELECT * FROM transactions
       WHERE sender_wallet = $1 OR recipient_wallet = $1
       ORDER BY created_at DESC LIMIT 50`,
      [wallet]
    );
    res.json({ transactions: result.rows });
  } catch (err) {
    console.error('List transactions error:', err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

/**
 * Record a transaction
 */
transactionsRouter.post('/', authenticateWallet, async (req: Request, res: Response) => {
  try {
    const sender = req.wallet!;
    const parseResult = createTxSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Invalid transaction record', details: parseResult.error.format() });
      return;
    }

    const data = parseResult.data;

    const result = await query(
      `INSERT INTO transactions (
        tx_hash, sender_wallet, recipient_wallet, tx_type, amount_xlm, status, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (tx_hash) DO UPDATE
      SET status = EXCLUDED.status, metadata = EXCLUDED.metadata
      RETURNING *`,
      [
        data.tx_hash,
        sender,
        data.recipient_wallet || null,
        data.tx_type,
        data.amount_xlm,
        data.status,
        JSON.stringify(data.metadata),
      ]
    );

    res.status(201).json({ transaction: result.rows[0] });
  } catch (err) {
    console.error('Record transaction error:', err);
    res.status(500).json({ error: 'Failed to record transaction' });
  }
});
