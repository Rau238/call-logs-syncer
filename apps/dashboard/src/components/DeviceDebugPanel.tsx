import type { CallLogRecord, DeviceDetail } from '../api';
import { RowActions } from './RowActions';
import { Badge, callTypeToBadgeVariant } from './ui/Badge';
import { Button } from './ui/Button';
import { tableClass, tableWrapClass, theadClass, thClass, tdClass, trHoverClass } from './ui/Panel';
import { cn } from '../lib/cn';
import { extractDeviceDebug, normalizeTelemetry } from '../utils/telemetry';
import {
  callTypeLabel,
  formatCallDateTime,
  formatDuration,
  formatPhoneNumber,
} from '../utils/format';

function labelize(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()).trim();
}

function boolBadge(value: unknown, trueLabel = 'Yes', falseLabel = 'No') {
  if (value === true) return <Badge variant="success">{trueLabel}</Badge>;
  if (value === false) return <Badge variant="danger">{falseLabel}</Badge>;
  return <span className="text-slate-500">—</span>;
}

function SummaryStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-800/70 bg-slate-950/50 px-3 py-2 text-center">
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}

function DebugRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,42%)_1fr] gap-x-3 gap-y-0.5 border-b border-slate-800/60 py-2 text-sm last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="min-w-0 text-right text-xs text-slate-200">{value}</span>
    </div>
  );
}

function DebugBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-800/70 bg-slate-900/40 p-3">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h4>
      {children}
    </div>
  );
}

function CollapsibleBlock({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="group rounded-lg border border-slate-800/70 bg-slate-900/40" open={defaultOpen}>
      <summary className="cursor-pointer list-none px-3 py-2.5 text-xs font-semibold text-slate-300 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          <span className="text-slate-500 transition group-open:rotate-90">▸</span>
          {title}
        </span>
      </summary>
      <div className="border-t border-slate-800/70 px-3 py-3">{children}</div>
    </details>
  );
}

interface Props {
  device: DeviceDetail;
  deleting: boolean;
  selectedDeviceCalls: Set<string>;
  onToggleDeviceCall: (serverId: string) => void;
  onToggleAllDeviceCalls: (calls: CallLogRecord[]) => void;
  onDeleteSelectedDeviceCalls: () => void;
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
  onEditCall,
  onDeleteCall,
}: Props) {
  const d = device.device;
  const t = normalizeTelemetry(d.telemetry);
  const debug = extractDeviceDebug(t);
  const { permissions, pluginStatus, sqliteDebug, syncStatus, scalar } = debug;
  const hasTelemetry = Boolean(d.telemetry_at && Object.keys(t).length > 0);

  const pending = syncStatus.pending ?? sqliteDebug.pending;
  const synced = syncStatus.synced ?? sqliteDebug.synced;
  const failed = syncStatus.failed ?? sqliteDebug.failed;
  const total = syncStatus.total ?? sqliteDebug.total;
  const pluginDeviceId = String(pluginStatus.deviceId ?? '—');
  const lastNativeSync = Number(pluginStatus.lastNativeSyncAt ?? 0);
  const pageSelectedCount = device.recentCalls.filter((c) => selectedDeviceCalls.has(c.serverId)).length;

  const networkLabel =
    t.networkName
      ? `${String(t.connectionType ?? 'unknown')} · ${String(t.networkName)}`
      : t.networkConnected === true
        ? 'Connected'
        : t.networkConnected === false
          ? 'Offline'
          : '—';

  return (
    <div className="space-y-3 p-3 sm:p-4">
      {!hasTelemetry && (
        <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2.5 text-xs text-amber-100">
          <strong className="font-semibold">No debug data on server yet.</strong>
          <p className="mt-1 text-amber-200/80">
            On the phone: open Call Log Sync → Debug info → Refresh or Force sync.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryStat label="Total calls" value={d.call_count} />
        <SummaryStat label="Active" value={d.active_count} />
        <SummaryStat label="Deleted" value={d.deleted_count} />
        <SummaryStat
          label="Status"
          value={<Badge variant={d.is_active ? 'success' : 'muted'}>{d.is_active ? 'Active' : 'Inactive'}</Badge>}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <DebugBlock title="Device & sync">
          <DebugRow label="Last seen" value={d.last_seen_at ? formatCallDateTime(d.last_seen_at) : 'Never'} />
          <DebugRow
            label="Telemetry"
            value={d.telemetry_at ? formatCallDateTime(d.telemetry_at) : 'Not reported'}
          />
          <DebugRow label="App version" value={String(t.appVersion ?? '—')} />
          <DebugRow label="Platform" value={String(t.platform ?? '—')} />
          <DebugRow label="OS" value={String(t.osVersion ?? '—')} />
          <DebugRow label="Network" value={networkLabel} />
        </DebugBlock>

        <DebugBlock title="SQLite & plugin">
          <DebugRow label="SQLite" value={boolBadge(sqliteDebug.ready, 'Ready', 'Not ready')} />
          <DebugRow label="Stored / Pending" value={`${total ?? '—'} / ${pending ?? '—'}`} />
          <DebugRow label="Synced / Failed" value={`${synced ?? '—'} / ${failed ?? '—'}`} />
          <DebugRow
            label="Call log observer"
            value={boolBadge(pluginStatus.observerActive, 'Active', 'Inactive')}
          />
          <DebugRow
            label="Background sync"
            value={
              pluginStatus.backgroundSyncConfigured
                ? pluginStatus.backgroundSyncPending
                  ? 'Configured · Pending'
                  : 'Configured'
                : 'Not configured'
            }
          />
          <DebugRow
            label="Last native sync"
            value={lastNativeSync > 0 ? formatCallDateTime(lastNativeSync) : '—'}
          />
        </DebugBlock>
      </div>

      <DebugBlock title="Permissions">
        {Object.keys(permissions).length === 0 ? (
          <p className="text-xs text-slate-500">No permissions reported — refresh debug on the phone.</p>
        ) : (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {Object.entries(permissions).map(([key, granted]) => (
              <div
                key={key}
                className={cn(
                  'flex items-center justify-between rounded-md border px-2.5 py-1.5 text-xs',
                  granted ? 'border-emerald-900/40 bg-emerald-950/20' : 'border-red-900/40 bg-red-950/20'
                )}
              >
                <span className="text-slate-200">{labelize(key)}</span>
                <Badge variant={granted ? 'success' : 'danger'}>{granted ? 'Granted' : 'Denied'}</Badge>
              </div>
            ))}
          </div>
        )}
      </DebugBlock>

      <CollapsibleBlock title="Auth & registration">
        <DebugRow label="Registered" value={boolBadge(d.is_active, 'Yes', 'Inactive')} />
        <DebugRow
          label="Auth"
          value={String(t.authStatus ?? (hasTelemetry ? 'Token + API key OK' : '—'))}
        />
        <DebugRow
          label="API URL"
          value={
            t.apiUrl ? (
              <span className="break-all font-mono text-[10px] text-indigo-300">{String(t.apiUrl)}</span>
            ) : (
              '—'
            )
          }
        />
        <DebugRow label="Plugin device ID" value={<span className="font-mono text-[10px]">{pluginDeviceId}</span>} />
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
      </CollapsibleBlock>

      <CollapsibleBlock title="Raw debug JSON">
        <pre className="scrollbar-thin max-h-40 overflow-auto rounded-md border border-slate-800 bg-slate-950/80 p-2 font-mono text-[10px] text-slate-300">
          {JSON.stringify({ pluginStatus, sqliteDebug, syncStatus, scalar, telemetry: t }, null, 2)}
        </pre>
      </CollapsibleBlock>

      <DebugBlock title="Recent calls on device">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-slate-500">{device.recentCalls.length} recent record(s)</span>
          {selectedDeviceCalls.size > 0 && (
            <Button variant="danger" size="sm" disabled={deleting} onClick={onDeleteSelectedDeviceCalls}>
              Delete selected ({selectedDeviceCalls.size})
            </Button>
          )}
        </div>

        {device.recentCalls.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-500">No recent calls for this device.</p>
        ) : (
          <div className="scrollbar-thin max-h-[min(420px,50vh)] overflow-y-auto rounded-md border border-slate-800/60">
            <div className={cn(tableWrapClass, 'hidden lg:block')}>
              <table className={cn(tableClass, 'min-w-[640px]')}>
                <thead className={theadClass}>
                  <tr>
                    <th className={cn(thClass, 'w-8')}>
                      <input
                        type="checkbox"
                        className="rounded border-slate-600"
                        checked={
                          device.recentCalls.length > 0 && pageSelectedCount === device.recentCalls.length
                        }
                        onChange={() => onToggleAllDeviceCalls(device.recentCalls)}
                      />
                    </th>
                    <th className={thClass}>Contact</th>
                    <th className={thClass}>Phone</th>
                    <th className={thClass}>Type</th>
                    <th className={thClass}>Duration</th>
                    <th className={thClass}>Time</th>
                    <th className={thClass}>Status</th>
                    <th className={cn(thClass, 'text-right')}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {device.recentCalls.map((c) => (
                    <tr key={c.serverId} className={cn(trHoverClass, c.isDeleted && 'opacity-75')}>
                      <td className={tdClass}>
                        <input
                          type="checkbox"
                          className="rounded border-slate-600"
                          checked={selectedDeviceCalls.has(c.serverId)}
                          onChange={() => onToggleDeviceCall(c.serverId)}
                        />
                      </td>
                      <td className={cn(tdClass, 'max-w-[100px] truncate font-medium', c.isDeleted && 'line-through text-slate-400')}>
                        {c.contactName || 'Unknown'}
                      </td>
                      <td className={cn(tdClass, 'font-mono text-[10px]')}>{formatPhoneNumber(c.phoneNumber)}</td>
                      <td className={tdClass}>
                        <Badge variant={callTypeToBadgeVariant(c.callType)}>{callTypeLabel(c.callType)}</Badge>
                      </td>
                      <td className={tdClass}>{formatDuration(c.duration)}</td>
                      <td className={cn(tdClass, 'text-[11px]')}>{formatCallDateTime(c.callTime)}</td>
                      <td className={tdClass}>
                        <Badge variant={c.isDeleted ? 'danger' : 'success'}>{c.isDeleted ? 'Deleted' : 'Active'}</Badge>
                      </td>
                      <td className={cn(tdClass, 'text-right')}>
                        <RowActions compact onEdit={() => onEditCall(c)} onDelete={() => onDeleteCall(c)} disabled={deleting} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-1.5 p-2 lg:hidden">
              {device.recentCalls.map((c) => (
                <div
                  key={c.serverId}
                  className={cn('rounded-md border border-slate-800/70 bg-slate-950/50 p-2', c.isDeleted && 'opacity-75')}
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-0.5 rounded border-slate-600"
                      checked={selectedDeviceCalls.has(c.serverId)}
                      onChange={() => onToggleDeviceCall(c.serverId)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className={cn('truncate text-xs font-medium text-slate-100', c.isDeleted && 'line-through')}>
                            {c.contactName || 'Unknown'}
                          </div>
                          <div className="font-mono text-[10px] text-slate-500">{formatPhoneNumber(c.phoneNumber)}</div>
                        </div>
                        <Badge variant={c.isDeleted ? 'danger' : 'success'}>{c.isDeleted ? 'Deleted' : 'Active'}</Badge>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        <Badge variant={callTypeToBadgeVariant(c.callType)}>{callTypeLabel(c.callType)}</Badge>
                        <Badge variant="muted">{formatDuration(c.duration)}</Badge>
                      </div>
                      <div className="mt-1 text-[10px] text-slate-400">{formatCallDateTime(c.callTime)}</div>
                      <div className="mt-1.5 flex justify-end">
                        <RowActions compact onEdit={() => onEditCall(c)} onDelete={() => onDeleteCall(c)} disabled={deleting} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </DebugBlock>
    </div>
  );
}
