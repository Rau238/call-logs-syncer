/** Normalize telemetry from API (jsonb object or string). */
export function normalizeTelemetry(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

export interface DeviceDebugSnapshot {
  permissions: Record<string, boolean>;
  pluginStatus: Record<string, unknown>;
  sqliteDebug: Record<string, unknown>;
  syncStatus: Record<string, unknown>;
  scalar: Record<string, unknown>;
}

/** Extract debug fields regardless of nesting / key naming. */
export function extractDeviceDebug(telemetry: Record<string, unknown>): DeviceDebugSnapshot {
  const pluginStatus = normalizeRecord(
    telemetry.pluginStatus ?? telemetry.plugin_status ?? telemetry.plugin
  );
  const pluginPerms = normalizePluginPerms(pluginStatus);

  const permissions: Record<string, boolean> = {
    ...pluginPerms,
    ...normalizeBoolRecord(telemetry.permissions),
  };

  const sqliteDebug = normalizeRecord(
    telemetry.sqliteDebug ?? telemetry.sqlite_debug ?? telemetry.debugInfo
  );

  const syncStatus = normalizeRecord(
    telemetry.syncStatus ?? telemetry.sync_status ?? telemetry.sync
  );

  const known = new Set([
    'permissions',
    'pluginStatus',
    'plugin_status',
    'plugin',
    'sqliteDebug',
    'sqlite_debug',
    'debugInfo',
    'syncStatus',
    'sync_status',
    'sync',
  ]);

  const scalar: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(telemetry)) {
    if (!known.has(key) && value !== undefined) {
      scalar[key] = value;
    }
  }

  return { permissions, pluginStatus, sqliteDebug, syncStatus, scalar };
}

function normalizeRecord(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

function normalizeBoolRecord(raw: unknown): Record<string, boolean> {
  const obj = normalizeRecord(raw);
  const out: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'boolean') out[key] = value;
  }
  return out;
}

function normalizePluginPerms(raw: unknown): Record<string, boolean> {
  return normalizeBoolRecord(normalizeRecord(raw).permissions);
}
