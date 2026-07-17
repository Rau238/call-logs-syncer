import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { execute, closePool } from '../config/database';
import { logger } from '../utils/logger';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const ADMIN_EMAIL = 'admin@enterprise.com';
const ADMIN_PASSWORD = 'admin123';

async function seedAdmin(): Promise<void> {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const updated = await execute(
    `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2`,
    [passwordHash, ADMIN_EMAIL]
  );

  if (updated === 0) {
    await execute(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, $2, 'System Admin', 'admin')`,
      [ADMIN_EMAIL, passwordHash]
    );
    logger.info(`Admin user created: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  } else {
    logger.info(`Admin password reset: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  }

  await closePool();
}

seedAdmin().catch((err) => {
  logger.error('Seed admin failed', err);
  process.exit(1);
});
