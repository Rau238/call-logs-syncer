import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config';
import { query, execute } from '../config/database';
import { generateApiKey, hashApiKey } from '../utils/crypto';

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  full_name: string;
  role: string;
}

export class AuthService {
  async login(
    email: string,
    password: string
  ): Promise<{ token: string; refreshToken: string; role: string } | null> {
    const user = await query<UserRow>(
      `SELECT id, email, password_hash, full_name, role
       FROM users WHERE email = $1 AND is_active = TRUE LIMIT 1`,
      [email]
    );

    if (!user.length) return null;

    const valid = await bcrypt.compare(password, user[0].password_hash);
    if (!valid) return null;

    const token = jwt.sign(
      { userId: user[0].id, email: user[0].email, role: user[0].role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn as SignOptions['expiresIn'] }
    );

    const refreshToken = jwt.sign(
      { userId: user[0].id, type: 'refresh' },
      config.jwt.secret,
      { expiresIn: '7d' as SignOptions['expiresIn'] }
    );

    return { token, refreshToken, role: user[0].role };
  }

  async registerDevice(
    deviceId: string,
    deviceName: string
  ): Promise<{ apiKey: string; token: string }> {
    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);

    const existing = await query<{ id: number }>(
      `SELECT id FROM devices WHERE device_id = $1 LIMIT 1`,
      [deviceId]
    );

    if (existing.length) {
      await execute(
        `UPDATE devices
         SET device_name = $1, api_key_hash = $2, is_active = TRUE,
             last_seen_at = NOW(), updated_at = NOW()
         WHERE device_id = $3`,
        [deviceName, apiKeyHash, deviceId]
      );
    } else {
      await execute(
        `INSERT INTO devices (device_id, device_name, api_key_hash, last_seen_at)
         VALUES ($1, $2, $3, NOW())`,
        [deviceId, deviceName, apiKeyHash]
      );
    }

    const token = jwt.sign({ deviceId }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn as SignOptions['expiresIn'],
    });

    return { apiKey, token };
  }
}
