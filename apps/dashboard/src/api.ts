import { normalizeTelemetry } from './utils/telemetry';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

export interface DashboardStats {
  totalCalls: number;
  totalDevices: number;
  activeDevices: number;
  callsToday: number;
  syncBatchesToday: number;
  activeCalls: number;
  deletedCalls: number;
  deletedToday: number;
  pendingSyncFailures: number;
  totalDurationSeconds: number;
  lastSyncAt: string | null;
}

export interface LiveSnapshot {
  totalCalls: number;
  callsToday: number;
  deletedCalls: number;
  lastSyncAt: string | null;
  lastCallAt: number | null;
  activeDevices: number;
  syncBatchesLastHour: number;
}

export interface DataRevision {
  revision: string;
  changed: boolean;
}

export interface Analytics {
  callsByType: Array<{ callType: string; count: number }>;
  callsByDay: Array<{ date: string; count: number; deleted: number }>;
  callsByHour: Array<{ hour: number; count: number }>;
  topNumbers: Array<{
    phoneNumber: string;
    contactName: string;
    callCount: number;
    totalDuration: number;
    deletedCount: number;
    lastCallTime: number;
  }>;
  deviceActivity: Array<{
    deviceId: string;
    deviceName: string;
    callCount: number;
    deletedCount: number;
    lastSeenAt: string | null;
  }>;
}

export interface CallLogRecord {
  serverId: string;
  deviceId: string;
  deviceName: string | null;
  androidId: number;
  phoneNumber: string;
  contactName: string;
  callType: string;
  duration: number;
  callTime: number;
  simSlot: number;
  hash: string;
  syncedAt: string;
  updatedAt?: string;
  isDeleted: boolean;
  deletedAt: string | null;
}

export interface ContactGroup {
  phoneNumber: string;
  contactName: string;
  callCount: number;
  incoming: number;
  outgoing: number;
  missed: number;
  deletedCount: number;
  totalDuration: number;
  lastCallTime: number;
  devices: string[];
}

export interface DeviceRecord {
  device_id: string;
  device_name: string;
  is_active: boolean;
  last_seen_at: string | null;
  telemetry_at: string | null;
  telemetry: Record<string, unknown>;
  call_count: number;
  deleted_count: number;
}

export interface DeviceDetail {
  device: {
    device_id: string;
    device_name: string;
    is_active: boolean;
    last_seen_at: string | null;
    telemetry_at: string | null;
    telemetry: Record<string, unknown>;
    call_count: number;
    deleted_count: number;
    active_count: number;
  };
  recentCalls: CallLogRecord[];
}

export interface SyncAuditEntry {
  id: number;
  deviceId: string;
  deviceName: string | null;
  batchSize: number;
  syncedCount: number;
  failedCount: number;
  ipAddress: string | null;
  createdAt: string;
}

export interface CallLogsResponse {
  calls: CallLogRecord[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface CallLogFilters {
  search?: string;
  deviceId?: string;
  deletedOnly?: boolean;
  activeOnly?: boolean;
  callType?: string;
}

function authHeaders(token: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function login(
  email: string,
  password: string
): Promise<{ token: string; role: string }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error('Login failed');
  return res.json();
}

export async function fetchStats(token: string): Promise<DashboardStats> {
  const res = await fetch(`${API_BASE}/admin/dashboard/stats`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to load stats');
  return res.json();
}

export async function fetchRevision(
  token: string,
  since?: string
): Promise<DataRevision> {
  const params = since ? `?since=${encodeURIComponent(since)}` : '';
  const res = await fetch(`${API_BASE}/admin/dashboard/revision${params}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to check data revision');
  return res.json();
}

export async function fetchAnalytics(token: string): Promise<Analytics> {
  const res = await fetch(`${API_BASE}/admin/dashboard/analytics`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to load analytics');
  return res.json();
}

export async function fetchCallLogs(
  token: string,
  page = 1,
  filters: CallLogFilters = {}
): Promise<CallLogsResponse> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: '50',
  });
  if (filters.search) params.set('search', filters.search);
  if (filters.deviceId) params.set('deviceId', filters.deviceId);
  if (filters.deletedOnly) params.set('deletedOnly', 'true');
  if (filters.activeOnly) params.set('activeOnly', 'true');
  if (filters.callType) params.set('callType', filters.callType);

  const res = await fetch(`${API_BASE}/admin/call-logs?${params}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to load call logs');
  return res.json();
}

export async function fetchContacts(
  token: string,
  page = 1,
  search = ''
): Promise<{ contacts: ContactGroup[]; total: number; hasMore: boolean; page: number }> {
  const params = new URLSearchParams({ page: String(page), pageSize: '50' });
  if (search) params.set('search', search);

  const res = await fetch(`${API_BASE}/admin/contacts?${params}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to load contacts');
  return res.json();
}

export async function fetchDevices(
  token: string
): Promise<{ devices: DeviceRecord[] }> {
  const res = await fetch(`${API_BASE}/admin/devices`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to load devices');
  const data = await res.json();
  return {
    devices: (data.devices ?? []).map((d: DeviceRecord) => ({
      ...d,
      telemetry: normalizeTelemetry(d.telemetry),
    })),
  };
}

export async function fetchDeviceDetail(
  token: string,
  deviceId: string
): Promise<DeviceDetail> {
  const res = await fetch(`${API_BASE}/admin/devices/${encodeURIComponent(deviceId)}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to load device detail');
  const data = (await res.json()) as DeviceDetail;
  return {
    ...data,
    device: {
      ...data.device,
      telemetry: normalizeTelemetry(data.device.telemetry),
    },
  };
}

export async function fetchSyncAudit(
  token: string,
  page = 1,
  deviceId = ''
): Promise<{ entries: SyncAuditEntry[]; total: number; hasMore: boolean }> {
  const params = new URLSearchParams({ page: String(page), pageSize: '50' });
  if (deviceId) params.set('deviceId', deviceId);

  const res = await fetch(`${API_BASE}/admin/sync-audit?${params}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to load sync audit');
  const data = await res.json();
  return {
    ...data,
    entries: (data.entries ?? []).map((e: SyncAuditEntry) => ({
      ...e,
      id: Number(e.id),
      batchSize: Number(e.batchSize),
      syncedCount: Number(e.syncedCount),
      failedCount: Number(e.failedCount),
    })),
  };
}

export async function deleteCallLog(
  token: string,
  serverId: string
): Promise<{ deleted: number; serverId: string }> {
  const res = await fetch(`${API_BASE}/admin/call-logs/${serverId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to delete call log');
  }
  return res.json();
}

export async function deleteCallLogs(
  token: string,
  serverIds: string[]
): Promise<{ deleted: number; notFound: string[]; requested: number }> {
  const res = await fetch(`${API_BASE}/admin/call-logs/delete`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ serverIds }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to delete call logs');
  }
  return res.json();
}

export interface CallLogUpdate {
  contactName?: string;
  phoneNumber?: string;
  callType?: string;
  duration?: number;
  callTime?: number;
  simSlot?: number;
  isDeleted?: boolean;
}

export async function updateCallLog(
  token: string,
  serverId: string,
  patch: CallLogUpdate
): Promise<{ updated: boolean; serverId: string }> {
  const res = await fetch(`${API_BASE}/admin/call-logs/${serverId}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to update call log');
  }
  return res.json();
}

export async function updateContact(
  token: string,
  phoneNumber: string,
  contactName: string
): Promise<{ updated: number; phoneNumber: string }> {
  const res = await fetch(
    `${API_BASE}/admin/contacts/${encodeURIComponent(phoneNumber)}`,
    {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ contactName }),
    }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to update contact');
  }
  return res.json();
}

export async function deleteCallsByPhone(
  token: string,
  phoneNumber: string
): Promise<{ deleted: number; phoneNumber: string }> {
  const res = await fetch(
    `${API_BASE}/admin/contacts/${encodeURIComponent(phoneNumber)}/calls`,
    {
      method: 'DELETE',
      headers: authHeaders(token),
    }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to delete contact calls');
  }
  return res.json();
}

export async function updateDevice(
  token: string,
  deviceId: string,
  patch: { deviceName?: string; isActive?: boolean }
): Promise<{ updated: boolean; deviceId: string }> {
  const res = await fetch(`${API_BASE}/admin/devices/${encodeURIComponent(deviceId)}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to update device');
  }
  return res.json();
}

export async function deleteDevice(
  token: string,
  deviceId: string
): Promise<{ deleted: boolean; deviceId: string }> {
  const res = await fetch(`${API_BASE}/admin/devices/${encodeURIComponent(deviceId)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to delete device');
  }
  return res.json();
}

export async function deleteDevices(
  token: string,
  deviceIds: string[]
): Promise<{ deleted: number; notFound: string[]; requested: number }> {
  const res = await fetch(`${API_BASE}/admin/devices/delete`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ deviceIds }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to delete devices');
  }
  return res.json();
}

export async function deleteContactCallsBulk(
  token: string,
  phoneNumbers: string[]
): Promise<{ deleted: number; requested: number }> {
  const res = await fetch(`${API_BASE}/admin/contacts/delete-calls`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ phoneNumbers }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to delete contact calls');
  }
  return res.json();
}

export async function deleteSyncAuditEntries(
  token: string,
  ids: number[]
): Promise<{ deleted: number; requested: number }> {
  const res = await fetch(`${API_BASE}/admin/sync-audit/delete`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ ids: ids.map((id) => Number(id)) }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to delete sync audit entries');
  }
  return res.json();
}

export async function deleteSyncAuditEntry(
  token: string,
  id: number
): Promise<{ deleted: boolean; id: number }> {
  const res = await fetch(`${API_BASE}/admin/sync-audit/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to delete sync audit entry');
  }
  return res.json();
}
