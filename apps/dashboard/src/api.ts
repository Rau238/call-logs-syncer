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

export async function fetchLive(token: string): Promise<LiveSnapshot> {
  const res = await fetch(`${API_BASE}/admin/dashboard/live`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to load live snapshot');
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
  return res.json();
}

export async function fetchDeviceDetail(
  token: string,
  deviceId: string
): Promise<DeviceDetail> {
  const res = await fetch(`${API_BASE}/admin/devices/${encodeURIComponent(deviceId)}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to load device detail');
  return res.json();
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
  return res.json();
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
