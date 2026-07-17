import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { CallLogService } from '../services/callLog.service';

const callLogService = new CallLogService();

export async function syncCall(req: AuthRequest, res: Response): Promise<void> {
  const call = req.body;
  const result = await callLogService.syncSingle(call);

  if (result === 'duplicate') {
    res.status(409).json({ error: 'Duplicate call log entry', hash: call.hash });
    return;
  }

  res.status(201).json({ serverId: result.serverId });
}

export async function batchSync(req: AuthRequest, res: Response): Promise<void> {
  const { deviceId, calls = [], deletions = [] } = req.body;

  if (req.deviceId && req.deviceId !== deviceId) {
    res.status(403).json({ error: 'Device ID mismatch with API key' });
    return;
  }

  const result = await callLogService.batchSync(
    deviceId,
    calls,
    deletions,
    req.ip
  );

  res.json(result);
}

export async function getHistory(req: AuthRequest, res: Response): Promise<void> {
  const { deviceId, page, pageSize } = req.query as {
    deviceId: string;
    page: string;
    pageSize: string;
  };

  const result = await callLogService.getHistory(
    deviceId,
    parseInt(page || '1', 10),
    parseInt(pageSize || '50', 10)
  );

  res.json({
    calls: result.calls.map(formatCall),
    total: result.total,
    page: parseInt(page || '1', 10),
    pageSize: parseInt(pageSize || '50', 10),
    hasMore: result.hasMore,
  });
}

export async function getPending(req: AuthRequest, res: Response): Promise<void> {
  const { deviceId, page, pageSize } = req.query as {
    deviceId: string;
    page: string;
    pageSize: string;
  };

  const result = await callLogService.getPending(
    deviceId,
    parseInt(page || '1', 10),
    parseInt(pageSize || '50', 10)
  );

  res.json({
    calls: result.calls.map(formatCall),
    total: result.total,
    page: parseInt(page || '1', 10),
    pageSize: parseInt(pageSize || '50', 10),
    hasMore: result.hasMore,
  });
}

export async function reportTelemetry(req: AuthRequest, res: Response): Promise<void> {
  const { deviceId, ...telemetry } = req.body as {
    deviceId: string;
    [key: string]: unknown;
  };

  if (req.deviceId && req.deviceId !== deviceId) {
    res.status(403).json({ error: 'Device ID mismatch with API key' });
    return;
  }

  const saved = await callLogService.saveDeviceTelemetry(deviceId, telemetry);
  if (!saved) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }
  res.json({ saved: true, deviceId });
}

function formatCall(row: {
  server_uuid: string;
  device_id: string;
  android_id: number;
  phone_number: string;
  contact_name: string;
  call_type: string;
  duration: number;
  call_time: number;
  sim_slot: number;
  hash: string;
  created_at: Date;
  is_deleted?: boolean;
  deleted_at?: Date | null;
}) {
  return {
    serverId: row.server_uuid,
    deviceId: row.device_id,
    androidId: row.android_id,
    phoneNumber: row.phone_number,
    contactName: row.contact_name,
    callType: row.call_type,
    duration: row.duration,
    callTime: row.call_time,
    simSlot: row.sim_slot,
    hash: row.hash,
    createdAt: row.created_at,
    isDeleted: row.is_deleted ?? false,
    deletedAt: row.deleted_at ?? null,
  };
}
