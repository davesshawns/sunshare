import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve migrations dir relative to current file or fallback to cwd
function findMigrationsDir(): string | null {
  const candidates = [
    path.resolve(__dirname, '../../database/migrations'),
    path.resolve(process.cwd(), 'database/migrations'),
    path.resolve(process.cwd(), '../database/migrations'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }
  return null;
}

function findSeedsDir(): string | null {
  const candidates = [
    path.resolve(__dirname, '../../database/seeds'),
    path.resolve(process.cwd(), 'database/seeds'),
    path.resolve(process.cwd(), '../database/seeds'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }
  return null;
}

export async function runMigrations() {
  console.log('🔄 Checking database connection and running migrations...');

  const migrationsDir = findMigrationsDir();
  if (!migrationsDir) {
    console.error('❌ Could not locate database/migrations directory.');
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    const migrationFiles = [
      '001_initial_schema.sql',
      '002_rls_policies.sql',
    ];

    for (const file of migrationFiles) {
      const fullPath = path.join(migrationsDir, file);
      if (fs.existsSync(fullPath)) {
        console.log(`⏳ Applying ${file}...`);
        const sql = fs.readFileSync(fullPath, 'utf8');
        await client.query(sql);
        console.log(`✅ Applied ${file}`);
      } else {
        console.warn(`⚠️ Warning: Migration file ${file} not found at ${fullPath}`);
      }
    }

    if (process.env.SEED_DEV === 'true') {
      const seedsDir = findSeedsDir();
      if (seedsDir) {
        const seedPath = path.join(seedsDir, '001_seed_dev.sql');
        if (fs.existsSync(seedPath)) {
          console.log(`🌱 Applying dev seed data...`);
          const seedSql = fs.readFileSync(seedPath, 'utf8');
          await client.query(seedSql);
          console.log(`✅ Dev seed data applied successfully.`);
        }
      }
    }

    console.log('🎉 Database migrations finished successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

// If executed directly, run migrations
if (process.argv[1] && process.argv[1].endsWith('migrate.js')) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

