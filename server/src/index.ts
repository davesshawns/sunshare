import { app } from './app.js';
import { config } from './config.js';

const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`⚡ SUNSHARE API Server running on port ${config.port} (0.0.0.0)`);
  console.log(`🌐 Stellar Network: ${config.stellar.network} (${config.stellar.rpcUrl})`);
  console.log(`📜 Contract ID: ${config.stellar.contractId}`);
});

const handleShutdown = (signal: string) => {
  console.log(`Received ${signal}. Shutting down SUNSHARE server cleanly...`);
  server.close(() => {
    console.log('SUNSHARE server shut down cleanly.');
    process.exit(0);
  });
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

