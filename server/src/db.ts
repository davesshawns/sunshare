import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString:
    process.env.NODE_ENV === 'test' ? config.databaseTestUrl : config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err);
});

export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}

/**
 * Executes a callback within a database client that has the authenticated
 * wallet address set for PostgreSQL Row Level Security (RLS).
 */
export async function withWallet<T>(
  walletAddress: string | null | undefined,
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    if (walletAddress) {
      await client.query("SELECT set_config('app.current_wallet', $1, false)", [
        walletAddress,
      ]);
    } else {
      await client.query("SELECT set_config('app.current_wallet', '', false)");
    }
    return await fn(client);
  } finally {
    try {
      await client.query("SELECT set_config('app.current_wallet', '', false)");
    } catch {
      // Ignore reset error on release
    }
    client.release();
  }
}
