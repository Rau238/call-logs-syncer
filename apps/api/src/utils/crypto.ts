import crypto from 'crypto';
import { config } from '../config';

export function hashApiKey(apiKey: string): string {
  return crypto
    .createHmac('sha256', config.security.apiKeySalt)
    .update(apiKey)
    .digest('hex');
}

export function generateApiKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateServerUuid(): string {
  return crypto.randomUUID();
}
