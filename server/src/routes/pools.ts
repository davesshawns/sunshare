import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query, withWallet } from '../db.js';
import { authenticateWallet, optionalWallet } from '../auth.js';
import { config } from '../config.js';

export const poolsRouter = Router();

const createPoolSchema = z.object({
  on_chain_pool_id: z.coerce.bigint(),
  token_address: z.string().default(config.stellar.contractId),
  title: z.string().min(3).max(150),
  description: z.string().optional(),
  target_funding_xlm: z.number().positive(),
  deadline: z.string().datetime(),
  zone_id: z.string().min(1),
  tx_hash: z.string().optional(),
});

const contributeSchema = z.object({
  amount_xlm: z.number().positive(),
  tx_hash: z.string().optional(),
});

/**
 * List community pools
 */
poolsRouter.get('/', optionalWallet, async (req: Request, res: Response) => {
  try {
    const { zone, status } = req.query;
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (zone) {
      conditions.push(`p.zone_id = $${idx++}`);
      values.push(zone);
    }
    if (status && status !== 'all') {
      conditions.push(`p.status = $${idx++}`);
      values.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT 
        p.*,
        pr.display_name AS creator_name,
        (SELECT COUNT(DISTINCT contributor_wallet) FROM pool_contributions WHERE pool_id = p.id) AS contributor_count
      FROM community_pools p
      JOIN profiles pr ON p.creator_wallet = pr.wallet_address
      ${whereClause}
      ORDER BY p.created_at DESC
    `;

    const result = await query(sql, values);
    res.json({ pools: result.rows });
  } catch (err) {
    console.error('List pools error:', err);
    res.status(500).json({ error: 'Failed to fetch community pools' });
  }
});

/**
 * Get pool details and contribution history
 */
poolsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const poolRes = await query(
      `SELECT p.*, pr.display_name AS creator_name
       FROM community_pools p
       JOIN profiles pr ON p.creator_wallet = pr.wallet_address
       WHERE p.id = $1 OR p.on_chain_pool_id = $1`,
      [id]
    );

    if (poolRes.rowCount === 0) {
      res.status(404).json({ error: 'Community pool not found' });
      return;
    }

    const pool = poolRes.rows[0];

    const contribs = await query(
      `SELECT c.*, pr.display_name AS contributor_name
       FROM pool_contributions c
       JOIN profiles pr ON c.contributor_wallet = pr.wallet_address
       WHERE c.pool_id = $1
       ORDER BY c.created_at DESC`,
      [pool.id]
    );

    res.json({
      pool,
      contributions: contribs.rows,
    });
  } catch (err) {
    console.error('Get pool error:', err);
    res.status(500).json({ error: 'Failed to fetch pool details' });
  }
});

/**
 * Create a new community energy pool
 */
poolsRouter.post('/', authenticateWallet, async (req: Request, res: Response) => {
  try {
    const creatorWallet = req.wallet!;
    const parseResult = createPoolSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Invalid pool data', details: parseResult.error.format() });
      return;
    }

    const data = parseResult.data;
    const targetStroops = Math.round(data.target_funding_xlm * config.stellar.stroopsPerXlm);

    const newPool = await withWallet(creatorWallet, async (client) => {
      const result = await client.query(
        `INSERT INTO community_pools (
          on_chain_pool_id, creator_wallet, token_address, title, description,
          target_funding_xlm, target_funding_stroops, deadline, zone_id, tx_hash
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        ) RETURNING *`,
        [
          data.on_chain_pool_id.toString(),
          creatorWallet,
          data.token_address,
          data.title,
          data.description || null,
          data.target_funding_xlm,
          targetStroops,
          data.deadline,
          data.zone_id,
          data.tx_hash || null,
        ]
      );
      return result.rows[0];
    });

    res.status(201).json({ pool: newPool });
  } catch (err: any) {
    console.error('Create pool error:', err);
    res.status(500).json({ error: err.message || 'Failed to create pool' });
  }
});

/**
 * Contribute funds to a community pool
 */
poolsRouter.post('/:id/contribute', authenticateWallet, async (req: Request, res: Response) => {
  try {
    const contributorWallet = req.wallet!;
    const { id } = req.params;
    const parseResult = contributeSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Invalid contribution amount', details: parseResult.error.format() });
      return;
    }

    const { amount_xlm, tx_hash } = parseResult.data;
    const amountStroops = Math.round(amount_xlm * config.stellar.stroopsPerXlm);

    const updatedPool = await withWallet(contributorWallet, async (client) => {
      const pRes = await client.query(
        `SELECT * FROM community_pools WHERE id = $1 FOR UPDATE`,
        [id]
      );
      if (pRes.rowCount === 0) {
        throw new Error('Community pool not found');
      }

      const pool = pRes.rows[0];
      if (pool.status !== 'funding') {
        throw new Error(`Pool is not in funding phase (${pool.status})`);
      }

      // Record contribution
      await client.query(
        `INSERT INTO pool_contributions (
          pool_id, contributor_wallet, amount_xlm, amount_stroops, tx_hash
        ) VALUES ($1, $2, $3, $4, $5)`,
        [pool.id, contributorWallet, amount_xlm, amountStroops, tx_hash || null]
      );

      // Update funding totals
      const newFundingXlm = parseFloat(pool.current_funding_xlm) + amount_xlm;
      const newFundingStroops = BigInt(pool.current_funding_stroops) + BigInt(amountStroops);
      const newStatus = newFundingXlm >= parseFloat(pool.target_funding_xlm) ? 'goal_reached' : 'funding';

      const updateRes = await client.query(
        `UPDATE community_pools
         SET current_funding_xlm = $1, current_funding_stroops = $2, status = $3, updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [newFundingXlm, newFundingStroops.toString(), newStatus, pool.id]
      );

      return updateRes.rows[0];
    });

    res.json({ pool: updatedPool });
  } catch (err: any) {
    console.error('Contribute error:', err);
    res.status(400).json({ error: err.message || 'Failed to contribute to pool' });
  }
});
