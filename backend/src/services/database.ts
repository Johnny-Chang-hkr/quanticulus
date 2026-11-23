import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { config } from '../config/env';

const databaseConfigured = Boolean(config.databaseUrl || process.env.PGHOST);
const pool = databaseConfigured
  ? new Pool(config.databaseUrl ? { connectionString: config.databaseUrl } : {})
  : null;

pool?.on('error', (error: Error) => {
  console.error(JSON.stringify({
    level: 'error',
    event: 'database_pool_error',
    message: error.message || 'An unexpected PostgreSQL connection error occurred.',
  }));
});

export function databaseStatus() {
  return { configured: databaseConfigured, connected: pool !== null && pool.totalCount > 0 };
}

export async function initializeDatabase() {
  if (!pool) return;
  const migration = await readFile(resolve(__dirname, '../../migrations/001_initial.sql'), 'utf8');
  await pool.query(migration);
  await pool.query("DELETE FROM candle_observations WHERE observation_date < CURRENT_DATE - INTERVAL '5 years'");
  await pool.query("DELETE FROM economic_observations WHERE observation_date < CURRENT_DATE - INTERVAL '5 years'");
}

export async function query<T extends import('pg').QueryResultRow = import('pg').QueryResultRow>(
  text: string,
  values?: unknown[],
) {
  if (!pool) return null;
  return pool.query<T>(text, values);
}

export async function closeDatabase() {
  if (pool) await pool.end();
}
