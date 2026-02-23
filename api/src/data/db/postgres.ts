import { Pool } from 'pg';
import { env } from '../../config/env.js';

let pool: Pool | null = null;

export const getPostgresPool = (): Pool => {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for postgres persistence.');
  }

  if (!pool) {
    pool = new Pool({ connectionString: env.DATABASE_URL });
  }

  return pool;
};

export const closePostgresPool = async (): Promise<void> => {
  if (!pool) {
    return;
  }

  await pool.end();
  pool = null;
};
