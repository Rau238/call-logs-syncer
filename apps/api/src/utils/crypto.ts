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

/** Matches mobile plugin: SHA-256(deviceId|phoneNumber|callTime|duration|callType) */
export function generateCallHash(
  deviceId: string,
  phoneNumber: string,
  callTime: number,
  duration: number,
  callType: string
): string {
  const payload = `${deviceId}|${phoneNumber}|${callTime}|${duration}|${callType}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}
