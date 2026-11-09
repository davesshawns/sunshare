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

// Enable CORS with support for wildcard/mirroring origin for credentialed requests
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, server-to-server, mobile)
      if (!origin) return callback(null, true);
      // If CORS_ORIGIN is '*' or not set, reflect requesting origin
      if (!config.corsOrigin || config.corsOrigin === '*') return callback(null, true);
      const allowed = config.corsOrigin.split(',').map((o) => o.trim());
      if (
        allowed.includes('*') ||
        allowed.includes(origin) ||
        origin.startsWith('http://localhost:') ||
        origin.endsWith('.onrender.com') ||
        origin.endsWith('.vercel.app')
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);
app.use(express.json());

// Root Index Endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'SUNSHARE — Peer-to-Peer Renewable Energy Exchange API',
    status: 'online',
    version: '1.0.0',
    network: config.stellar.network,
    contractId: config.stellar.contractId,
    endpoints: {
      health: '/health',
      status: '/api/status',
      auth: '/api/auth',
      profiles: '/api/profiles',
      offers: '/api/offers',
      reservations: '/api/reservations',
      meters: '/api/meters',
      pools: '/api/pools',
      transactions: '/api/transactions',
      notifications: '/api/notifications',
    },
    documentation: 'https://github.com/davesshawns/sunshare',
  });
});

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

