import { app } from './app.js';
import { config } from './config.js';

const server = app.listen(config.port, () => {
  console.log(`⚡ SUNSHARE API Server running at http://localhost:${config.port}`);
  console.log(`🌐 Stellar Network: ${config.stellar.network} (${config.stellar.rpcUrl})`);
  console.log(`📜 Contract ID: ${config.stellar.contractId}`);
});

process.on('SIGINT', () => {
  server.close(() => {
    console.log('SUNSHARE server shut down cleanly.');
    process.exit(0);
  });
});

