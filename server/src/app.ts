import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { authRouter } from './routes/auth.js';
import { profilesRouter } from './routes/profiles.js';
import { offersRouter } from './routes/offers.js';
import { reservationsRouter } from './routes/reservations.js';
import { metersRouter } from './routes/meters.js';
import { poolsRouter } from './routes/pools.js';
import { transactionsRouter } from './routes/transactions.js';
import { notificationsRouter } from './routes/notifications.js';

export const app = express();

app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json());

// Health & System Info
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'sunshare-api',
    stellarNetwork: config.stellar.network,
    contractId: config.stellar.contractId,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/status', (_req, res) => {
  res.json({
    name: 'SUNSHARE — Peer-to-Peer Energy Exchange',
    version: '1.0.0',
    network: 'Stellar Testnet',
    currency: 'XLM (Native Stellar Lumens)',
    contractId: config.stellar.contractId,
    features: [
      'P2P Energy Trading Escrow',
      'Cryptographic Smart Meter Verification (Ed25519)',
      'Replay Attack Prevention via Nonce Hashing',
      'Community Solar & Battery Infrastructure Pools',
      'Automated Expiry Settlement & Refund',
      'On-Chain Verifiable Reputation',
    ],
  });
});

// Mount Routes
app.use('/api/auth', authRouter);
app.use('/api/profiles', profilesRouter);
app.use('/api/offers', offersRouter);
app.use('/api/reservations', reservationsRouter);
app.use('/api/meters', metersRouter);
app.use('/api/pools', poolsRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/notifications', notificationsRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal Server Error', details: err?.message });
});
