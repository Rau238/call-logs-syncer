import { Response } from 'express';
import { AuthService } from '../services/auth.service';
import { AuthRequest } from '../middleware/auth';

const authService = new AuthService();

export async function login(req: AuthRequest, res: Response): Promise<void> {
  const { email, password } = req.body;
  const result = await authService.login(email, password);

  if (!result) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  res.json(result);
}

export async function registerDevice(req: AuthRequest, res: Response): Promise<void> {
  const { deviceId, deviceName = 'Android Device' } = req.body;
  const result = await authService.registerDevice(deviceId, deviceName);
  res.status(201).json(result);
}
