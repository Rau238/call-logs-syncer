import type { CallLogRecord, DeviceDetail } from '../api';
import { RowActions } from './RowActions';
import { extractDeviceDebug, normalizeTelemetry } from '../utils/telemetry';
import {
  callTypeBadgeClass,
  callTypeLabel,
  formatCallDateTime,
  formatDuration,
  formatPhoneNumber,
} from '../utils/format';

function labelize(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()).trim();
}

function boolBadge(value: unknown, trueLabel = 'Yes', falseLabel = 'No') {
  if (value === true) return <span className="badge synced">{trueLabel}</span>;
  if (value === false) return <span className="badge failed">{falseLabel}</span>;
  return <span className="muted">—</span>;
}

function DebugRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="debug-kv-row">
      <span className="debug-kv-label">{label}</span>
      <span className="debug-kv-value">{value}</span>
    </div>
  );
}

interface Props {
  device: DeviceDetail;
  deleting: boolean;
  selectedDeviceCalls: Set<string>;
  onToggleDeviceCall: (serverId: string) => void;
  onToggleAllDeviceCalls: (calls: CallLogRecord[]) => void;
  onDeleteSelectedDeviceCalls: () => void;
  onEditDevice: () => void;
  onDeleteDevice: () => void;
  onEditCall: (call: CallLogRecord) => void;
  onDeleteCall: (call: CallLogRecord) => void;
}

export function DeviceDebugPanel({
  device,
  deleting,
  selectedDeviceCalls,
  onToggleDeviceCall,
  onToggleAllDeviceCalls,
  onDeleteSelectedDeviceCalls,
  onEditDevice,
  onDeleteDevice,
  onEditCall,
  onDeleteCall,
}: Props) {
  const d = device.device;
  const t = normalizeTelemetry(d.telemetry);
  const debug = extractDeviceDebug(t);
  const { permissions, pluginStatus, sqliteDebug, syncStatus, scalar } = debug;
  const hasTelemetry = Boolean(d.telemetry_at && Object.keys(t).length > 0);

  const sqliteReady = sqliteDebug.ready;
  const sqliteNative = sqliteDebug.native;
  const pending = syncStatus.pending ?? sqliteDebug.pending;
  const synced = syncStatus.synced ?? sqliteDebug.synced;
  const failed = syncStatus.failed ?? sqliteDebug.failed;
  const total = syncStatus.total ?? sqliteDebug.total;
  const pluginDeviceId = String(pluginStatus.deviceId ?? '—');
  const lastNativeSync = Number(pluginStatus.lastNativeSyncAt ?? 0);

  return (
    <div className="debug-panel">
      {!hasTelemetry && (
        <div className="debug-empty-banner">
          <strong>No debug data on server yet.</strong>
          <p>
            On the phone: open Call Log Sync → tap <em>Debug info (show)</em> → tap{' '}
            <em>Refresh</em> or run <em>Force sync</em>. Data uploads automatically.
          </p>
        </div>
      )}

      <div className="debug-section">
        <div className="debug-section-header">
          <h4>Device identity</h4>
          <RowActions onEdit={onEditDevice} onDelete={onDeleteDevice} disabled={deleting} />
        </div>
        <div className="debug-kv-grid">
          <DebugRow label="Device name" value={d.device_name || 'Unnamed'} />
          <DebugRow label="Device ID" value={<span className="mono">{d.device_id}</span>} />
          <DebugRow
            label="Server status"
            value={
              <span className={`badge ${d.is_active ? 'synced' : 'failed'}`}>
                {d.is_active ? 'Active' : 'Inactive'}
              </span>
            }
          />
          <DebugRow
            label="Last seen"
            value={d.last_seen_at ? formatCallDateTime(d.last_seen_at) : 'Never'}
          />
          <DebugRow
            label="Telemetry uploaded"
            value={d.telemetry_at ? formatCallDateTime(d.telemetry_at) : 'Not reported yet'}
          />
          {t.reportedAt != null && (
            <DebugRow label="Reported at (device)" value={formatCallDateTime(String(t.reportedAt))} />
          )}
        </div>
      </div>

      <div className="debug-section">
        <h4>Calls on server</h4>
        <div className="debug-kv-grid">
          <DebugRow label="Total synced" value={String(d.call_count)} />
          <DebugRow label="Active" value={String(d.active_count)} />
          <DebugRow label="Deleted from phone" value={String(d.deleted_count)} />
          <DebugRow label="Recent in panel" value={String(device.recentCalls.length)} />
        </div>
      </div>

      <div className="debug-section">
        <h4>App, platform & network</h4>
        <div className="debug-kv-grid">
          <DebugRow label="App version" value={String(t.appVersion ?? '—')} />
          <DebugRow label="Platform" value={String(t.platform ?? '—')} />
          <DebugRow label="OS" value={String(t.osVersion ?? '—')} />
          <DebugRow
            label="Network (last report)"
            value={
              t.networkName
                ? `${String(t.connectionType ?? 'unknown')} · ${String(t.networkName)}`
                : t.networkConnected === true
                  ? 'Connected'
                  : t.networkConnected === false
                    ? 'Offline'
                    : '—'
            }
          />
        </div>
      </div>

      <div className="debug-section">
        <h4>Auth & registration</h4>
        <div className="debug-kv-grid">
          <DebugRow
            label="Registered on server"
            value={boolBadge(d.is_active, 'Yes', 'Inactive')}
          />
          <DebugRow
            label="Auth"
            value={String(t.authStatus ?? (hasTelemetry ? 'Token + API key OK (upload succeeded)' : '—'))}
          />
          <DebugRow
            label="API"
            value={
              t.apiUrl ? (
                <span className="mono debug-api-url">{String(t.apiUrl)}</span>
              ) : (
                '—'
              )
            }
          />
          <DebugRow label="Plugin device ID" value={<span className="mono">{pluginDeviceId}</span>} />
          <DebugRow
            label="IDs match"
            value={
              pluginDeviceId !== '—' && pluginDeviceId === d.device_id
                ? boolBadge(true, 'Match', 'Mismatch')
                : pluginDeviceId === '—'
                  ? '—'
                  : boolBadge(false, 'Match', 'Mismatch')
            }
          />
        </div>
      </div>

      <div className="debug-section">
        <h4>SQLite (on device)</h4>
        <div className="debug-kv-grid">
          <DebugRow label="SQLite" value={boolBadge(sqliteReady, 'Ready', 'Not initialized')} />
          <DebugRow
            label="Platform"
            value={sqliteNative === true ? 'Native Android' : sqliteNative === false ? 'Web (no SQLite)' : '—'}
          />
          <DebugRow label="Stored" value={String(total ?? '—')} />
          <DebugRow label="Pending" value={String(pending ?? '—')} />
          <DebugRow label="Synced" value={String(synced ?? '—')} />
          <DebugRow label="Failed" value={String(failed ?? '—')} />
        </div>
      </div>

      <div className="debug-section">
        <h4>Plugin & observers</h4>
        <div className="debug-kv-grid">
          <DebugRow
            label="Call log observer"
            value={boolBadge(pluginStatus.observerActive, 'Active', 'Inactive')}
          />
          <DebugRow
            label="Contacts observer"
            value={boolBadge(pluginStatus.contactsObserverActive, 'Active', 'Inactive')}
          />
          <DebugRow label="Tracked calls (native)" value={String(pluginStatus.trackedCallsCount ?? '—')} />
          <DebugRow
            label="Background sync"
            value={
              pluginStatus.backgroundSyncConfigured
                ? `Configured${pluginStatus.backgroundSyncPending ? ' · Pending flag set' : ''}`
                : 'Not configured'
            }
          />
          <DebugRow
            label="Last native sync"
            value={lastNativeSync > 0 ? formatCallDateTime(lastNativeSync) : '—'}
          />
        </div>
      </div>

      <div className="debug-section">
        <h4>Permissions</h4>
        <div className="perm-grid">
          {Object.keys(permissions).length === 0 ? (
            <p className="muted">No permissions reported — open the mobile app and tap Refresh in debug info.</p>
          ) : (
            Object.entries(permissions).map(([key, granted]) => (
              <div key={key} className={`perm-item ${granted ? 'granted' : 'denied'}`}>
                <span>{labelize(key)}</span>
                <span className={`badge ${granted ? 'synced' : 'failed'}`}>
                  {granted ? 'Granted ✓' : 'Denied ✗'}
                </span>
              </div>
            ))
          )}
        </div>
        <p className="debug-hint">
          Call log, Contacts, Phone state, and Notifications — same checks as the mobile debug panel.
        </p>
      </div>

      <div className="debug-section">
        <h4>Plugin / observer (full)</h4>
        <pre className="debug-json">
          {Object.keys(pluginStatus).length > 0
            ? JSON.stringify(pluginStatus, null, 2)
            : '{} — not reported yet'}
        </pre>
      </div>

      <div className="debug-section">
        <h4>SQLite / sync debug (full)</h4>
        <pre className="debug-json">
          {JSON.stringify(
            { sqliteDebug, syncStatus },
            null,
            2
          )}
        </pre>
      </div>

      {Object.keys(scalar).length > 0 && (
        <div className="debug-section">
          <h4>Other reported fields</h4>
          <div className="debug-kv-grid">
            {Object.entries(scalar).map(([key, value]) => (
              <DebugRow
                key={key}
                label={labelize(key)}
                value={
                  typeof value === 'object' ? (
                    <pre className="debug-inline-json">{JSON.stringify(value)}</pre>
                  ) : (
                    String(value ?? '—')
                  )
                }
              />
            ))}
          </div>
        </div>
      )}

      {(Object.keys(syncStatus).length > 0 || Object.keys(sqliteDebug).length > 0) && (
        <div className="debug-section">
          <h4>Sync debug (raw fields)</h4>
          <div className="debug-kv-grid">
            {Object.entries({ ...sqliteDebug, ...syncStatus })
              .filter(([key]) => !['ready', 'native', 'pending', 'synced', 'failed', 'total'].includes(key))
              .map(([key, value]) => (
                <DebugRow
                  key={key}
                  label={labelize(key)}
                  value={
                    typeof value === 'object' ? (
                      <pre className="debug-inline-json">{JSON.stringify(value)}</pre>
                    ) : (
                      String(value ?? '—')
                    )
                  }
                />
              ))}
          </div>
        </div>
      )}

      <details className="debug-section debug-raw">
        <summary>Full telemetry JSON</summary>
        <pre className="debug-json">{JSON.stringify(t, null, 2)}</pre>
      </details>

      <div className="debug-section">
        <div className="debug-section-header">
          <h4>Recent calls on device</h4>
          <div className="debug-section-actions">
            {selectedDeviceCalls.size > 0 && (
              <button
                type="button"
                className="btn-danger-sm"
                disabled={deleting}
                onClick={onDeleteSelectedDeviceCalls}
              >
                Delete selected ({selectedDeviceCalls.size})
              </button>
            )}
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="col-check">
                  <input
                    type="checkbox"
                    checked={
                      device.recentCalls.length > 0 &&
                      selectedDeviceCalls.size === device.recentCalls.length
                    }
                    onChange={() => onToggleAllDeviceCalls(device.recentCalls)}
                  />
                </th>
                <th>Contact</th>
                <th>Phone</th>
                <th>Type</th>
                <th>Duration</th>
                <th>Time</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {device.recentCalls.map((c) => (
                <tr key={c.serverId} className={c.isDeleted ? 'row-deleted' : ''}>
                  <td className="col-check">
                    <input
                      type="checkbox"
                      checked={selectedDeviceCalls.has(c.serverId)}
                      onChange={() => onToggleDeviceCall(c.serverId)}
                    />
                  </td>
                  <td>{c.contactName || 'Unknown'}</td>
                  <td className="mono">{formatPhoneNumber(c.phoneNumber)}</td>
                  <td>
                    <span className={`badge ${callTypeBadgeClass(c.callType)}`}>
                      {callTypeLabel(c.callType)}
                    </span>
                  </td>
                  <td>{formatDuration(c.duration)}</td>
                  <td>{formatCallDateTime(c.callTime)}</td>
                  <td>
                    {c.isDeleted ? (
                      <span className="badge deleted">Deleted</span>
                    ) : (
                      <span className="badge synced">Active</span>
                    )}
                  </td>
                  <td>
                    <RowActions
                      onEdit={() => onEditCall(c)}
                      onDelete={() => onDeleteCall(c)}
                      disabled={deleting}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
