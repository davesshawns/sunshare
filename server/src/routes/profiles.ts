import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query, withWallet } from '../db.js';
import { authenticateWallet } from '../auth.js';
import { getTestnetXlmBalance } from '../stellar.js';

export const profilesRouter = Router();

const updateProfileSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  role: z.enum(['producer', 'consumer', 'prosumer', 'admin']).optional(),
  zone_id: z.string().min(1).max(50).optional(),
  solar_capacity_kw: z.number().min(0).optional(),
  battery_capacity_kwh: z.number().min(0).optional(),
  meter_pubkey: z.string().optional(),
  avatar_seed: z.string().optional(),
});

/**
 * Get public profile, reputation stats, and recent energy deliveries
 */
profilesRouter.get('/:wallet', async (req: Request, res: Response) => {
  try {
    const { wallet } = req.params;
    const profileRes = await query(
      `SELECT * FROM profiles WHERE wallet_address = $1`,
      [wallet]
    );

    if (profileRes.rowCount === 0) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    const profile = profileRes.rows[0];
    const balanceXlm = await getTestnetXlmBalance(wallet);

    // Fetch recent reputation events
    const repEvents = await query(
      `SELECT * FROM reputation_events WHERE producer_wallet = $1 ORDER BY created_at DESC LIMIT 10`,
      [wallet]
    );

    res.json({
      profile,
      balanceXlm,
      reputationEvents: repEvents.rows,
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

/**
 * Update authenticated user's profile
 */
profilesRouter.put('/me', authenticateWallet, async (req: Request, res: Response) => {
  try {
    const wallet = req.wallet!;
    const parseResult = updateProfileSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Invalid profile data', details: parseResult.error.format() });
      return;
    }

    const data = parseResult.data;

    const updated = await withWallet(wallet, async (client) => {
      const setClauses: string[] = ['updated_at = NOW()'];
      const values: any[] = [wallet];
      let idx = 2;

      if (data.display_name !== undefined) {
        setClauses.push(`display_name = $${idx++}`);
        values.push(data.display_name);
      }
      if (data.role !== undefined) {
        setClauses.push(`role = $${idx++}`);
        values.push(data.role);
      }
      if (data.zone_id !== undefined) {
        setClauses.push(`zone_id = $${idx++}`);
        values.push(data.zone_id);
      }
      if (data.solar_capacity_kw !== undefined) {
        setClauses.push(`solar_capacity_kw = $${idx++}`);
        values.push(data.solar_capacity_kw);
      }
      if (data.battery_capacity_kwh !== undefined) {
        setClauses.push(`battery_capacity_kwh = $${idx++}`);
        values.push(data.battery_capacity_kwh);
      }
      if (data.meter_pubkey !== undefined) {
        setClauses.push(`meter_pubkey = $${idx++}`);
        values.push(data.meter_pubkey);
      }
      if (data.avatar_seed !== undefined) {
        setClauses.push(`avatar_seed = $${idx++}`);
        values.push(data.avatar_seed);
      }

      const q = `
        UPDATE profiles
        SET ${setClauses.join(', ')}
        WHERE wallet_address = $1
        RETURNING *
      `;
      const result = await client.query(q, values);
      return result.rows[0];
    });

    res.json({ profile: updated });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});
