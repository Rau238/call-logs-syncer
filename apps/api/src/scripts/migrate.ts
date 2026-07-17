import fs from 'fs';
import path from 'path';
import { getPool, closePool } from '../config/database';
import { logger } from '../utils/logger';

async function migrate(): Promise<void> {
  const migrationsDir = path.resolve(
    __dirname,
    '../../../../infrastructure/postgres/migrations'
  );

  if (!fs.existsSync(migrationsDir)) {
    logger.error(`Migrations directory not found: ${migrationsDir}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    logger.error('No migration files found.');
    process.exit(1);
  }

  try {
    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      await getPool().query(sql);
      logger.info(`Applied migration: ${file}`);
    }
    logger.info('PostgreSQL migrations applied successfully.');
  } catch (err) {
    logger.error('Migration failed. Check apps/api/.env and pgAdmin connection.');
    throw err;
  } finally {
    await closePool();
  }
}

migrate().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
