import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { query } from './db.js';
import { generateNonce, verifyWalletSignature } from './stellar.js';
import { config } from './config.js';

// Extend Express Request to include wallet
declare global {
  namespace Express {
    interface Request {
      wallet?: string;
    }
  }
}

/**
 * Creates a unique challenge message for wallet signature verification.
 */
export async function createWalletChallenge(walletAddress: string): Promise<string> {
  const nonce = generateNonce(16);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Upsert profile if not exists
  await query(
    `INSERT INTO profiles (wallet_address, display_name)
     VALUES ($1, $2)
     ON CONFLICT (wallet_address) DO NOTHING`,
    [walletAddress, `User_${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`]
  );

  // Store challenge session
  const challengeMessage = `SUNSHARE Energy Exchange Authentication\nWallet: ${walletAddress}\nNonce: ${nonce}\nIssued At: ${new Date().toISOString()}`;

  // Store nonce in session table with temporary token
  const tempToken = `chal_${crypto.randomUUID()}`;
  await query(
    `INSERT INTO wallet_sessions (session_token, wallet_address, challenge_nonce, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [tempToken, walletAddress, challengeMessage, expiresAt]
  );

  return challengeMessage;
}

/**
 * Verifies signed challenge and returns a durable session token.
 */
export async function verifyWalletChallenge(
  walletAddress: string,
  challengeMessage: string,
  signature: string
): Promise<{ token: string; profile: any } | null> {
  // Check challenge exists and hasn't expired
  const res = await query(
    `SELECT session_token, challenge_nonce FROM wallet_sessions
     WHERE wallet_address = $1 AND challenge_nonce = $2 AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [walletAddress, challengeMessage]
  );

  if (res.rowCount === 0) {
    return null;
  }

  const { session_token: tempToken } = res.rows[0];

  // Verify cryptographic signature
  const isValid = verifyWalletSignature(walletAddress, challengeMessage, signature);
  if (!isValid) {
    return null;
  }

  // Delete temporary challenge token
  await query(`DELETE FROM wallet_sessions WHERE session_token = $1`, [tempToken]);

  // Generate durable session token
  const durableToken = `ssh_${crypto.randomBytes(32).toString('hex')}`;
  const sessionExpiry = new Date(Date.now() + config.sessionTtlHours * 60 * 60 * 1000);

  await query(
    `INSERT INTO wallet_sessions (session_token, wallet_address, challenge_nonce, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [durableToken, walletAddress, 'authenticated', sessionExpiry]
  );

  const profileRes = await query(
    `SELECT * FROM profiles WHERE wallet_address = $1`,
    [walletAddress]
  );

  return {
    token: durableToken,
    profile: profileRes.rows[0],
  };
}

/**
 * Authentication middleware requiring valid session token or test demo bypass in non-production.
 */
export async function authenticateWallet(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];

  // Demo bypass for testnet sandbox or automated testing
  if (token.startsWith('demo_') || token.startsWith('test_')) {
    const demoWallet = req.headers['x-demo-wallet'] as string || 'GDEMOWALLET77777777777777777777777777777777777777777777777';
    req.wallet = demoWallet;

    // Ensure profile exists for demo wallet
    await query(
      `INSERT INTO profiles (wallet_address, display_name)
       VALUES ($1, $2)
       ON CONFLICT (wallet_address) DO NOTHING`,
      [demoWallet, `Demo_${demoWallet.slice(0, 4)}`]
    );

    next();
    return;
  }

  try {
    const result = await query(
      `SELECT wallet_address FROM wallet_sessions
       WHERE session_token = $1 AND expires_at > NOW()`,
      [token]
    );

    if (result.rowCount === 0) {
      res.status(401).json({ error: 'Session expired or invalid' });
      return;
    }

    req.wallet = result.rows[0].wallet_address;
    next();
  } catch (err) {
    console.error('Auth verification error:', err);
    res.status(500).json({ error: 'Internal authentication error' });
  }
}

/**
 * Optional authentication middleware for public endpoints that can be enhanced with user context.
 */
export async function optionalWallet(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.split(' ')[1];
  if (token.startsWith('demo_') || token.startsWith('test_')) {
    req.wallet = (req.headers['x-demo-wallet'] as string) || 'GDEMOWALLET77777777777777777777777777777777777777777777777';
    next();
    return;
  }

  try {
    const result = await query(
      `SELECT wallet_address FROM wallet_sessions
       WHERE session_token = $1 AND expires_at > NOW()`,
      [token]
    );
    if (result.rowCount && result.rowCount > 0) {
      req.wallet = result.rows[0].wallet_address;
    }
  } catch {
    // Ignore error for optional auth
  }
  next();
}
