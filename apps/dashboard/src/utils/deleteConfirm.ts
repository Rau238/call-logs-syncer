import type {
  CallLogRecord,
  ContactGroup,
  DeviceDetail,
  DeviceRecord,
  SyncAuditEntry,
} from '../api';
import {
  callTypeLabel,
  formatCallDateTime,
  formatDuration,
  formatPhoneNumber,
} from './format';

export interface ConfirmDeletePayload {
  title: string;
  question: string;
  summary: string;
  details: { label: string; value: string }[];
  willRemove: string[];
  preview?: string[];
}

function summarizeTelemetry(device: DeviceRecord, detail?: DeviceDetail | null) {
  const t = (detail?.device.telemetry ?? device.telemetry ?? {}) as Record<string, unknown>;
  const permissions = (t.permissions ?? {}) as Record<string, boolean>;
  const pluginStatus = (t.pluginStatus ?? {}) as Record<string, unknown>;
  const sqliteDebug = (t.sqliteDebug ?? {}) as Record<string, unknown>;
  const syncStatus = (t.syncStatus ?? {}) as Record<string, unknown>;

  const permissionLines = Object.entries(permissions).map(
    ([key, granted]) =>
      `${key.replace(/([A-Z])/g, ' $1').trim()}: ${granted ? 'Granted ✓' : 'Denied ✗'}`
  );

  return {
    permissionLines:
      permissionLines.length > 0 ? permissionLines : ['No permissions reported yet — open mobile app to sync'],
    hasPluginData: Object.keys(pluginStatus).length > 0,
    hasDebugData: Object.keys(sqliteDebug).length > 0,
    pluginSummary:
      Object.keys(pluginStatus).length > 0
        ? `${Object.keys(pluginStatus).length} plugin/observer field(s) stored`
        : 'No plugin/observer debug data stored',
    debugSummary:
      Object.keys(sqliteDebug).length > 0
        ? `${Object.keys(sqliteDebug).length} SQLite/sync debug field(s) stored`
        : 'No SQLite/sync debug data stored',
    appVersion: String(t.appVersion ?? '—'),
    platform: [t.platform, t.osVersion].filter(Boolean).join(' ') || '—',
    network: t.networkConnected === true ? 'Connected' : t.networkConnected === false ? 'Offline' : '—',
    telemetryAt: detail?.device.telemetry_at ?? device.telemetry_at,
    authStatus: String(t.authStatus ?? (detail?.device.telemetry_at ? 'Token + API key OK' : 'Not reported')),
    apiUrl: String(t.apiUrl ?? '—'),
    sqliteSummary:
      sqliteDebug.ready === true
        ? 'Ready (native)'
        : sqliteDebug.ready === false
          ? 'Not initialized'
          : '—',
    syncCounts: `${syncStatus.total ?? sqliteDebug.total ?? '—'} / ${syncStatus.pending ?? sqliteDebug.pending ?? '—'} / ${syncStatus.synced ?? sqliteDebug.synced ?? '—'} / ${syncStatus.failed ?? sqliteDebug.failed ?? '—'}`,
    observerStatus: pluginStatus.observerActive
      ? `Active · ${pluginStatus.trackedCallsCount ?? 0} native calls tracked`
      : pluginStatus.observerActive === false
        ? 'Inactive'
        : '—',
  };
}

export function buildCallDeleteConfirm(call: CallLogRecord): ConfirmDeletePayload {
  return {
    title: 'Delete call log',
    question: 'Are you sure you want to permanently delete this call log from the server?',
    summary: 'This removes one synced call record. It cannot be undone.',
    details: [
      { label: 'Contact', value: call.contactName || 'Unknown' },
      { label: 'Phone', value: formatPhoneNumber(call.phoneNumber) },
      { label: 'Type', value: callTypeLabel(call.callType) },
      { label: 'Duration', value: formatDuration(call.duration) },
      { label: 'Call time', value: formatCallDateTime(call.callTime) },
      { label: 'Device', value: `${call.deviceName || 'Device'} (${call.deviceId})` },
      { label: 'Status', value: call.isDeleted ? 'Deleted from phone' : 'Active' },
      { label: 'Server ID', value: call.serverId },
    ],
    willRemove: [
      'Call log record (contact, phone, duration, type, timestamps)',
      'Sync hash and Android call ID mapping',
      call.isDeleted ? 'Deleted-from-phone flag and deleted timestamp' : 'Active call status on server',
    ],
  };
}

export function buildCallsBulkDeleteConfirm(calls: CallLogRecord[]): ConfirmDeletePayload {
  const active = calls.filter((c) => !c.isDeleted).length;
  const deleted = calls.length - active;
  const preview = calls.slice(0, 8).map(
    (c) =>
      `${c.contactName || 'Unknown'} · ${formatPhoneNumber(c.phoneNumber)} · ${callTypeLabel(c.callType)} · ${formatCallDateTime(c.callTime)}`
  );

  return {
    title: `Delete ${calls.length} call log(s)`,
    question: `Permanently delete ${calls.length} selected call log(s) from the database?`,
    summary: `${active} active and ${deleted} marked deleted from phone will be removed.`,
    details: [
      { label: 'Selected', value: String(calls.length) },
      { label: 'Active calls', value: String(active) },
      { label: 'Deleted from phone', value: String(deleted) },
    ],
    willRemove: [
      `${calls.length} call log record(s) with contact, phone, duration, and timestamps`,
      'Associated sync hashes and device mappings',
      'Any deleted-from-phone status flags for selected rows',
    ],
    preview: preview.length < calls.length ? [...preview, `…and ${calls.length - preview.length} more`] : preview,
  };
}

export function buildContactDeleteConfirm(contact: ContactGroup): ConfirmDeletePayload {
  return {
    title: 'Delete all calls for contact',
    question: `Delete every call log synced for ${formatPhoneNumber(contact.phoneNumber)}?`,
    summary: `${contact.callCount} call record(s) will be permanently removed.`,
    details: [
      { label: 'Contact', value: contact.contactName || 'Unknown' },
      { label: 'Phone', value: formatPhoneNumber(contact.phoneNumber) },
      { label: 'Total calls', value: String(contact.callCount) },
      { label: 'Incoming / Outgoing / Missed', value: `${contact.incoming} / ${contact.outgoing} / ${contact.missed}` },
      { label: 'Talk time', value: formatDuration(contact.totalDuration) },
      { label: 'Devices', value: contact.devices.join(', ') || '—' },
      { label: 'Last call', value: formatCallDateTime(contact.lastCallTime) },
    ],
    willRemove: [
      `All ${contact.callCount} call log(s) for this phone number`,
      'Contact name associations on those records',
      contact.deletedCount > 0
        ? `${contact.deletedCount} record(s) marked deleted from phone`
        : 'No phone-deleted records in this group',
    ],
  };
}

export function buildContactsBulkDeleteConfirm(contacts: ContactGroup[]): ConfirmDeletePayload {
  const totalCalls = contacts.reduce((sum, c) => sum + c.callCount, 0);
  const preview = contacts.slice(0, 6).map(
    (c) => `${c.contactName || 'Unknown'} · ${formatPhoneNumber(c.phoneNumber)} · ${c.callCount} calls`
  );

  return {
    title: `Delete ${contacts.length} contact(s)`,
    question: `Permanently delete all call logs for ${contacts.length} selected phone number(s)?`,
    summary: `${totalCalls} total call record(s) across selected contacts will be removed.`,
    details: [
      { label: 'Contacts selected', value: String(contacts.length) },
      { label: 'Total call logs', value: String(totalCalls) },
    ],
    willRemove: [
      `All call logs for ${contacts.length} phone number(s)`,
      'Contact names and call history for those numbers',
      'Sync data linked to those call records',
    ],
    preview,
  };
}

export function buildDeviceDeleteConfirm(
  device: DeviceRecord,
  detail?: DeviceDetail | null
): ConfirmDeletePayload {
  const tel = summarizeTelemetry(device, detail);
  const activeCount = detail?.device.active_count ?? device.call_count - device.deleted_count;
  const deletedCount = detail?.device.deleted_count ?? device.deleted_count;

  return {
    title: 'Delete device',
    question: `Delete device "${device.device_name || device.device_id}" and all related server data?`,
    summary: 'This removes the device registration, telemetry, debug snapshots, and every synced call from this phone.',
    details: [
      { label: 'Device name', value: device.device_name || 'Unnamed' },
      { label: 'Device ID', value: device.device_id },
      { label: 'Status', value: device.is_active ? 'Active' : 'Inactive' },
      { label: 'Calls synced', value: `${device.call_count} (${activeCount} active, ${deletedCount} deleted)` },
      { label: 'Last seen', value: device.last_seen_at ? formatCallDateTime(device.last_seen_at) : 'Never' },
      { label: 'Telemetry', value: tel.telemetryAt ? formatCallDateTime(tel.telemetryAt) : 'Not reported yet' },
      { label: 'Auth', value: tel.authStatus },
      { label: 'API', value: tel.apiUrl },
      { label: 'SQLite', value: tel.sqliteSummary },
      { label: 'Stored / Pending / Synced / Failed', value: tel.syncCounts },
      { label: 'Call log observer', value: tel.observerStatus },
      { label: 'App / Platform', value: `${tel.appVersion} · ${tel.platform}` },
      { label: 'Network (last report)', value: tel.network },
    ],
    willRemove: [
      'Device registration and API access for this phone',
      `${device.call_count} synced call log record(s) from this device`,
      'Stored permissions snapshot (Call log, Contacts, Phone, etc.)',
      tel.pluginSummary,
      tel.debugSummary,
      'Device telemetry and debug information',
      'Recent-calls list shown in this panel',
    ],
    preview: tel.permissionLines,
  };
}

export function buildDevicesBulkDeleteConfirm(devices: DeviceRecord[]): ConfirmDeletePayload {
  const totalCalls = devices.reduce((sum, d) => sum + d.call_count, 0);
  const withTelemetry = devices.filter((d) => d.telemetry_at).length;
  const preview = devices.slice(0, 6).map(
    (d) =>
      `${d.device_name || 'Unnamed'} · ${d.device_id.slice(0, 12)}… · ${d.call_count} calls · telemetry: ${d.telemetry_at ? 'yes' : 'no'}`
  );

  return {
    title: `Delete ${devices.length} device(s)`,
    question: `Permanently delete ${devices.length} selected device(s) and all their data?`,
    summary: `${totalCalls} call log(s) and ${withTelemetry} telemetry/debug snapshot(s) will be removed.`,
    details: [
      { label: 'Devices selected', value: String(devices.length) },
      { label: 'Total call logs', value: String(totalCalls) },
      { label: 'With telemetry/debug', value: String(withTelemetry) },
    ],
    willRemove: [
      `${devices.length} device registration(s) and API keys`,
      `${totalCalls} call log record(s) linked to these devices`,
      'Permissions, plugin status, and SQLite debug data stored per device',
      'Device telemetry history and last-seen records',
    ],
    preview,
  };
}

export function buildSyncAuditDeleteConfirm(entry: SyncAuditEntry): ConfirmDeletePayload {
  return {
    title: 'Delete sync audit entry',
    question: 'Remove this sync batch record from the audit log?',
    summary: 'Call logs themselves are not deleted — only this sync history entry.',
    details: [
      { label: 'Time', value: formatCallDateTime(entry.createdAt) },
      { label: 'Device', value: entry.deviceName || entry.deviceId },
      { label: 'Batch size', value: String(entry.batchSize) },
      { label: 'Synced', value: String(entry.syncedCount) },
      { label: 'Failed', value: String(entry.failedCount) },
      { label: 'IP address', value: entry.ipAddress || '—' },
    ],
    willRemove: [
      'This sync audit log entry',
      'Batch statistics (synced/failed counts) for this upload',
      'IP and timestamp metadata for this sync event',
    ],
  };
}

export function buildSyncAuditBulkDeleteConfirm(entries: SyncAuditEntry[]): ConfirmDeletePayload {
  const syncedTotal = entries.reduce((s, e) => s + e.syncedCount, 0);
  const preview = entries.slice(0, 6).map(
    (e) =>
      `${formatCallDateTime(e.createdAt)} · ${e.deviceName || e.deviceId.slice(0, 10)} · ${e.syncedCount} synced`
  );

  return {
    title: `Delete ${entries.length} sync audit entries`,
    question: `Remove ${entries.length} selected sync history record(s)?`,
    summary: `Covers ${syncedTotal} total synced calls across selected batches. Actual call logs stay on the server.`,
    details: [
      { label: 'Entries selected', value: String(entries.length) },
      { label: 'Total synced (in batches)', value: String(syncedTotal) },
    ],
    willRemove: [
      `${entries.length} sync audit log entries`,
      'Batch upload history, IP addresses, and timestamps',
      'Sync success/failure statistics for selected batches',
    ],
    preview,
  };
}

export function buildDeviceCallsBulkDeleteConfirm(
  calls: CallLogRecord[],
  deviceName: string
): ConfirmDeletePayload {
  const payload = buildCallsBulkDeleteConfirm(calls);
  return {
    ...payload,
    title: `Delete ${calls.length} call(s) from ${deviceName}`,
    question: `Permanently delete ${calls.length} selected call(s) from this device?`,
    summary: payload.summary,
  };
}
