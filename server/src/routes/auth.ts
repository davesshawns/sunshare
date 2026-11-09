import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  createWalletChallenge,
  verifyWalletChallenge,
  authenticateWallet,
} from '../auth.js';
import { query } from '../db.js';
import { getTestnetXlmBalance } from '../stellar.js';

export const authRouter = Router();

const challengeSchema = z.object({
  wallet: z.string().min(56).max(56),
});

const verifySchema = z.object({
  wallet: z.string().min(56).max(56),
  challenge: z.string().min(1),
  signature: z.string().min(1),
});

/**
 * Request authentication challenge for a Stellar wallet address
 */
authRouter.get('/challenge', async (req: Request, res: Response) => {
  try {
    const parseResult = challengeSchema.safeParse(req.query);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Valid 56-character Stellar wallet address required' });
      return;
    }

    const { wallet } = parseResult.data;
    const challenge = await createWalletChallenge(wallet);
    res.json({ challenge });
  } catch (err: any) {
    console.error('Challenge generation error:', err);
    res.status(500).json({ error: 'Failed to generate challenge' });
  }
});

/**
 * Verify signed challenge and issue session token
 */
authRouter.post('/verify', async (req: Request, res: Response) => {
  try {
    const parseResult = verifySchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({ error: 'Invalid verification payload', details: parseResult.error.format() });
      return;
    }

    const { wallet, challenge, signature } = parseResult.data;
    const session = await verifyWalletChallenge(wallet, challenge, signature);

    if (!session) {
      res.status(401).json({ error: 'Invalid challenge signature or expired nonce' });
      return;
    }

    const xlmBalance = await getTestnetXlmBalance(wallet);

    res.json({
      token: session.token,
      profile: session.profile,
      balanceXlm: xlmBalance,
    });
  } catch (err: any) {
    console.error('Challenge verify error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

/**
 * Instant demo login for local sandbox and evaluation
 */
authRouter.post('/demo', async (req: Request, res: Response) => {
  try {
    const { role = 'prosumer', wallet } = req.body;
    const demoWallet = wallet || 'GDEMOWALLET77777777777777777777777777777777777777777777777';

    // Upsert demo profile
    await query(
      `INSERT INTO profiles (wallet_address, role, display_name, zone_id, solar_capacity_kw, battery_capacity_kwh, reputation_score)
       VALUES ($1, $2, $3, 'ZONE_A', 12.5, 20.0, 100)
       ON CONFLICT (wallet_address) DO UPDATE
       SET role = EXCLUDED.role, display_name = EXCLUDED.display_name`,
      [demoWallet, role, `Demo ${role.toUpperCase()}`]
    );

    const token = `demo_${demoWallet}`;
    const profileRes = await query(`SELECT * FROM profiles WHERE wallet_address = $1`, [demoWallet]);

    res.json({
      token,
      profile: profileRes.rows[0],
      balanceXlm: '10000.0000000',
    });
  } catch (err) {
    console.error('Demo auth error:', err);
    res.status(500).json({ error: 'Failed to create demo session' });
  }
});

/**
 * Get current authenticated profile and live Stellar Testnet balance
 */
authRouter.get('/me', authenticateWallet, async (req: Request, res: Response) => {
  try {
    const wallet = req.wallet!;
    const profileRes = await query(`SELECT * FROM profiles WHERE wallet_address = $1`, [wallet]);
    if (profileRes.rowCount === 0) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    const xlmBalance = await getTestnetXlmBalance(wallet);

    res.json({
      profile: profileRes.rows[0],
      balanceXlm: xlmBalance,
    });
  } catch (err) {
    console.error('Fetch me error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

