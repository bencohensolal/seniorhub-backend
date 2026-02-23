import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { closePostgresPool, getPostgresPool } from '../data/db/postgres.js';

const migrate = async (): Promise<void> => {
  const pool = getPostgresPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const migrationsDir = path.resolve(process.cwd(), 'migrations');
  const files = (await readdir(migrationsDir))
    .filter((entry) => entry.endsWith('.sql'))
    .sort((left, right) => left.localeCompare(right));

  for (const version of files) {
    const alreadyApplied = await pool.query<{ version: string }>(
      'SELECT version FROM schema_migrations WHERE version = $1 LIMIT 1',
      [version],
    );

    if (alreadyApplied.rowCount && alreadyApplied.rowCount > 0) {
      continue;
    }

    const migrationPath = path.join(migrationsDir, version);
    const sql = await readFile(migrationPath, 'utf8');
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [version]);
      await client.query('COMMIT');
      console.info(`Applied migration: ${version}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  await closePostgresPool();
};

migrate().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
