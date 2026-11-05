import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3003', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl:
    process.env.DATABASE_URL || 'postgres:///sunshare?host=/var/run/postgresql',
  databaseTestUrl:
    process.env.DATABASE_TEST_URL ||
    'postgres:///sunshare_test?host=/var/run/postgresql',
  stellar: {
    network: process.env.STELLAR_NETWORK || 'testnet',
    networkPassphrase:
      process.env.STELLAR_NETWORK_PASSPHRASE ||
      'Test SDF Network ; September 2015',
    rpcUrl:
      process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org',
    horizonUrl:
      process.env.STELLAR_HORIZON_URL ||
      'https://horizon-testnet.stellar.org',
    contractId:
      process.env.SUNSHARE_CONTRACT_ID ||
      'CBZ3D74BRL6T74X35E2RHK3F4EQH2Z5T6KLRB62E3K4PY7W2X6EEXAMPLE',
    nativeAssetCode: 'XLM',
    stroopsPerXlm: 10_000_000,
  },
  corsOrigin: process.env.CORS_ORIGIN || '*',
  sessionTtlHours: 24,
};
