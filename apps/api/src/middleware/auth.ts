import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { query } from '../config/database';
import { hashApiKey } from '../utils/crypto';

export interface AuthRequest extends Request {
  userId?: number;
  deviceId?: string;
  userRole?: string;
}

interface DeviceRow {
  device_id: string;
  is_active: boolean;
}

export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as {
      userId?: number;
      deviceId?: string;
      role?: string;
    };
    req.userId = decoded.userId;
    req.deviceId = decoded.deviceId;
    req.userRole = decoded.role;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function adminMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (req.userRole !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

export async function apiKeyMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const apiKey = req.headers['x-api-key'] as string;
  if (!apiKey) {
    res.status(401).json({ error: 'Missing X-API-Key header' });
    return;
  }

  const apiKeyHash = hashApiKey(apiKey);
  const devices = await query<DeviceRow>(
    `SELECT device_id, is_active FROM devices WHERE api_key_hash = $1 LIMIT 1`,
    [apiKeyHash]
  );

  if (!devices.length || !devices[0].is_active) {
    res.status(403).json({ error: 'Invalid or inactive device API key' });
    return;
  }

  req.deviceId = devices[0].device_id;
  next();
}

export function validateBody<T>(
  schema: { parse: (data: unknown) => T },
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    res.status(400).json({
      error: 'Validation failed',
      details: error instanceof Error ? error.message : error,
    });
  }
}
