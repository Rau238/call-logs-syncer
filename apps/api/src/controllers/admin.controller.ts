import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { parseJsonObject } from '../config/database';
import { CallLogService } from '../services/callLog.service';

const callLogService = new CallLogService();

export async function getDashboardStats(
  _req: AuthRequest,
  res: Response
): Promise<void> {
  const stats = await callLogService.getDashboardStats();
  res.json(stats);
}

export async function getAnalytics(
  _req: AuthRequest,
  res: Response
): Promise<void> {
  const analytics = await callLogService.getAnalytics();
  res.json(analytics);
}

export async function getLiveSnapshot(
  _req: AuthRequest,
  res: Response
): Promise<void> {
  const snapshot = await callLogService.getLiveSnapshot();
  res.json(snapshot);
}

export async function getDataRevision(req: AuthRequest, res: Response): Promise<void> {
  const since = req.query.since as string | undefined;
  const result = await callLogService.getDataRevision(since);
  res.set('Cache-Control', 'no-store');
  res.json(result);
}

export async function getAllCallLogs(req: AuthRequest, res: Response): Promise<void> {
  const page = parseInt(String(req.query.page || '1'), 10);
  const pageSize = parseInt(String(req.query.pageSize || '50'), 10);
  const deviceId = req.query.deviceId as string | undefined;
  const search = req.query.search as string | undefined;
  const deletedOnly = req.query.deletedOnly === 'true';
  const activeOnly = req.query.activeOnly === 'true';
  const callType = req.query.callType as string | undefined;

  const result = await callLogService.getAllCalls(page, pageSize, deviceId, search, {
    deletedOnly,
    activeOnly,
    callType,
  });

  res.json({
    calls: result.calls.map(formatCall),
    total: result.total,
    page,
    pageSize,
    hasMore: result.hasMore,
  });
}

export async function getContacts(req: AuthRequest, res: Response): Promise<void> {
  const page = parseInt(String(req.query.page || '1'), 10);
  const pageSize = parseInt(String(req.query.pageSize || '50'), 10);
  const search = req.query.search as string | undefined;

  const result = await callLogService.getContactsGrouped(page, pageSize, search);
  res.json({ ...result, page, pageSize });
}

export async function getAllDevices(
  _req: AuthRequest,
  res: Response
): Promise<void> {
  const devices = await callLogService.getAllDevices();
  res.json({
    devices: devices.map((d) => ({
      device_id: d.device_id,
      device_name: d.device_name,
      is_active: d.is_active,
      last_seen_at: d.last_seen_at,
      telemetry_at: d.telemetry_at,
      telemetry: parseJsonObject(d.telemetry),
      call_count: d.call_count,
      deleted_count: d.deleted_count,
    })),
  });
}

export async function getDeviceDetail(req: AuthRequest, res: Response): Promise<void> {
  const deviceId = String(req.params.deviceId ?? '');
  const detail = await callLogService.getDeviceDetail(deviceId);

  if (!detail.device) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }

  res.json({
    device: {
      device_id: detail.device.device_id,
      device_name: detail.device.device_name,
      is_active: detail.device.is_active,
      last_seen_at: detail.device.last_seen_at,
      telemetry_at: detail.device.telemetry_at,
      telemetry: detail.device.telemetry ?? {},
      call_count: detail.device.call_count,
      deleted_count: detail.device.deleted_count,
      active_count: detail.device.active_count,
    },
    recentCalls: detail.recentCalls.map(formatCall),
  });
}

export async function getSyncAudit(req: AuthRequest, res: Response): Promise<void> {
  const page = parseInt(String(req.query.page || '1'), 10);
  const pageSize = parseInt(String(req.query.pageSize || '50'), 10);
  const deviceId = req.query.deviceId as string | undefined;

  const result = await callLogService.getSyncAudit(page, pageSize, deviceId);
  res.json({ ...result, page, pageSize });
}

export async function deleteCallLog(req: AuthRequest, res: Response): Promise<void> {
  const serverId = String(req.params.serverId ?? '');

  if (!serverId) {
    res.status(400).json({ error: 'serverId is required' });
    return;
  }

  const deleted = await callLogService.deleteByServerId(serverId);
  if (!deleted) {
    res.status(404).json({ error: 'Call log not found' });
    return;
  }

  res.json({ deleted: 1, serverId });
}

export async function deleteCallLogs(req: AuthRequest, res: Response): Promise<void> {
  const { serverIds } = req.body as { serverIds: string[] };
  const result = await callLogService.deleteMany(serverIds);

  res.json({
    deleted: result.deleted,
    notFound: result.notFound,
    requested: serverIds.length,
  });
}

export async function updateCallLog(req: AuthRequest, res: Response): Promise<void> {
  const serverId = String(req.params.serverId ?? '');

  try {
    const result = await callLogService.updateCallLog(serverId, req.body);
    if (!result.updated) {
      res.status(404).json({ error: 'Call log not found' });
      return;
    }
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed';
    if (message.includes('duplicate')) {
      res.status(409).json({ error: message });
      return;
    }
    throw err;
  }
}

export async function updateContact(req: AuthRequest, res: Response): Promise<void> {
  const phoneNumber = decodeURIComponent(String(req.params.phoneNumber ?? ''));
  const { contactName } = req.body as { contactName: string };
  const updated = await callLogService.updateContactName(phoneNumber, contactName);
  res.json({ updated, phoneNumber });
}

export async function deleteContactCalls(req: AuthRequest, res: Response): Promise<void> {
  const phoneNumber = decodeURIComponent(String(req.params.phoneNumber ?? ''));
  const deleted = await callLogService.deleteCallsByPhone(phoneNumber);
  res.json({ deleted, phoneNumber });
}

export async function deleteContactCallsBulk(req: AuthRequest, res: Response): Promise<void> {
  const { phoneNumbers } = req.body as { phoneNumbers: string[] };
  let deleted = 0;
  for (const phoneNumber of phoneNumbers) {
    deleted += await callLogService.deleteCallsByPhone(phoneNumber);
  }
  res.json({ deleted, requested: phoneNumbers.length });
}

export async function updateDevice(req: AuthRequest, res: Response): Promise<void> {
  const deviceId = String(req.params.deviceId ?? '');
  const updated = await callLogService.updateDevice(deviceId, req.body);
  if (!updated) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }
  res.json({ updated: true, deviceId });
}

export async function deleteDevice(req: AuthRequest, res: Response): Promise<void> {
  const deviceId = String(req.params.deviceId ?? '');
  const deleted = await callLogService.deleteDevice(deviceId);
  if (!deleted) {
    res.status(404).json({ error: 'Device not found' });
    return;
  }
  res.json({ deleted: true, deviceId });
}

export async function deleteDevices(req: AuthRequest, res: Response): Promise<void> {
  const { deviceIds } = req.body as { deviceIds: string[] };
  const result = await callLogService.deleteManyDevices(deviceIds);
  res.json({ deleted: result.deleted, notFound: result.notFound, requested: deviceIds.length });
}

export async function deleteSyncAuditEntries(req: AuthRequest, res: Response): Promise<void> {
  const { ids } = req.body as { ids: number[] };
  const result = await callLogService.deleteManySyncAudit(ids);
  res.json({ deleted: result.deleted, requested: ids.length });
}

export async function deleteSyncAuditEntry(req: AuthRequest, res: Response): Promise<void> {
  const id = parseInt(String(req.params.id ?? ''), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'Invalid audit id' });
    return;
  }
  const deleted = await callLogService.deleteSyncAuditEntry(id);
  if (!deleted) {
    res.status(404).json({ error: 'Sync audit entry not found' });
    return;
  }
  res.json({ deleted: true, id });
}

function formatCall(row: {
  server_uuid: string;
  device_id: string;
  device_name?: string | null;
  android_id: number;
  phone_number: string;
  contact_name: string;
  call_type: string;
  duration: number;
  call_time: number;
  sim_slot: number;
  hash: string;
  created_at: Date;
  updated_at?: Date;
  is_deleted?: boolean;
  deleted_at?: Date | null;
}) {
  return {
    serverId: row.server_uuid,
    deviceId: row.device_id,
    deviceName: row.device_name ?? null,
    androidId: row.android_id,
    phoneNumber: row.phone_number,
    contactName: row.contact_name,
    callType: row.call_type,
    duration: row.duration,
    callTime: Number(row.call_time),
    simSlot: row.sim_slot,
    hash: row.hash,
    syncedAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
    isDeleted: row.is_deleted ?? false,
    deletedAt: row.deleted_at ?? null,
  };
}
