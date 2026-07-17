import { useCallback, useEffect, useRef, useState } from 'react';
import {
  login,
  fetchStats,
  fetchLive,
  fetchAnalytics,
  fetchCallLogs,
  fetchContacts,
  fetchDevices,
  fetchDeviceDetail,
  fetchSyncAudit,
  deleteCallLog,
  deleteCallLogs,
  DashboardStats,
  LiveSnapshot,
  Analytics,
  CallLogRecord,
  ContactGroup,
  DeviceRecord,
  DeviceDetail,
  SyncAuditEntry,
} from './api';
import { ChartsPanel } from './components/ChartsPanel';
import {
  callTypeBadgeClass,
  callTypeLabel,
  formatCallDateTime,
  formatDuration,
  formatPhoneNumber,
  formatSimSlot,
} from './utils/format';

type Tab = 'overview' | 'analytics' | 'calls' | 'contacts' | 'devices' | 'sync';

const PAGE_SIZE = 50;
const LIVE_INTERVAL_MS = 4000;

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [email, setEmail] = useState('admin@enterprise.com');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [live, setLive] = useState<LiveSnapshot | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [calls, setCalls] = useState<CallLogRecord[]>([]);
  const [contacts, setContacts] = useState<ContactGroup[]>([]);
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [syncAudit, setSyncAudit] = useState<SyncAuditEntry[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<DeviceDetail | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [deviceFilter, setDeviceFilter] = useState('');
  const [callTypeFilter, setCallTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'deleted'>('all');
  const [page, setPage] = useState(1);
  const [contactsPage, setContactsPage] = useState(1);
  const [syncPage, setSyncPage] = useState(1);
  const [totalCalls, setTotalCalls] = useState(0);
  const [totalContacts, setTotalContacts] = useState(0);
  const [totalSync, setTotalSync] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [hasMoreContacts, setHasMoreContacts] = useState(false);
  const [hasMoreSync, setHasMoreSync] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [livePulse, setLivePulse] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [expandedContact, setExpandedContact] = useState<string | null>(null);
  const tabRef = useRef(tab);

  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const result = await login(email, password);
      if (result.role !== 'admin') {
        setError('Admin role required');
        return;
      }
      localStorage.setItem('token', result.token);
      setToken(result.token);
    } catch {
      setError('Invalid credentials');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken('');
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
    setContactsPage(1);
    setSelected(new Set());
  }, [debouncedSearch, deviceFilter, callTypeFilter, statusFilter]);

  useEffect(() => {
    setSelected(new Set());
  }, [page]);

  const loadTabData = useCallback(
    async (currentTab: Tab, silent = false) => {
      if (!token) return;
      if (!silent) setInitialLoading(true);
      setError('');
      try {
        const [s, l, d] = await Promise.all([
          fetchStats(token),
          fetchLive(token),
          fetchDevices(token),
        ]);
        setStats(s);
        setLive(l);
        setDevices(d.devices);

        if (currentTab === 'analytics' || currentTab === 'overview') {
          const a = await fetchAnalytics(token);
          setAnalytics(a);
        }

        if (currentTab === 'calls' || currentTab === 'overview') {
          const c = await fetchCallLogs(token, page, {
            search: debouncedSearch,
            deviceId: deviceFilter,
            callType: callTypeFilter || undefined,
            deletedOnly: statusFilter === 'deleted',
            activeOnly: statusFilter === 'active',
          });
          setCalls(c.calls);
          setTotalCalls(c.total);
          setHasMore(c.hasMore);
        }

        if (currentTab === 'contacts') {
          const cg = await fetchContacts(token, contactsPage, debouncedSearch);
          setContacts(cg.contacts);
          setTotalContacts(cg.total);
          setHasMoreContacts(cg.hasMore);
        }

        if (currentTab === 'sync') {
          const sa = await fetchSyncAudit(token, syncPage, deviceFilter);
          setSyncAudit(sa.entries);
          setTotalSync(sa.total);
          setHasMoreSync(sa.hasMore);
        }

        setLastUpdated(new Date());
        setLivePulse(true);
        setTimeout(() => setLivePulse(false), 600);
      } catch {
        if (!silent) setError('Failed to load dashboard data');
      } finally {
        if (!silent) setInitialLoading(false);
      }
    },
    [
      token,
      page,
      contactsPage,
      syncPage,
      debouncedSearch,
      deviceFilter,
      callTypeFilter,
      statusFilter,
    ]
  );

  const loadDeviceDetail = useCallback(
    async (deviceId: string) => {
      if (!token) return;
      try {
        const detail = await fetchDeviceDetail(token, deviceId);
        setSelectedDevice(detail);
      } catch {
        setError('Failed to load device details');
      }
    },
    [token]
  );

  useEffect(() => {
    loadTabData(tab);
  }, [tab, page, contactsPage, syncPage, debouncedSearch, deviceFilter, callTypeFilter, statusFilter, token]);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      loadTabData(tabRef.current, true);
    }, LIVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [token, loadTabData]);

  const toggleSelect = (serverId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(serverId)) next.delete(serverId);
      else next.add(serverId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === calls.length) setSelected(new Set());
    else setSelected(new Set(calls.map((c) => c.serverId)));
  };

  const handleDeleteOne = async (serverId: string) => {
    if (!token || !confirm('Permanently delete this call log from the database?')) return;
    setDeleting(true);
    try {
      await deleteCallLog(token, serverId);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(serverId);
        return next;
      });
      await loadTabData(tab, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (!token || selected.size === 0) return;
    if (!confirm(`Permanently delete ${selected.size} call log(s)?`)) return;
    setDeleting(true);
    try {
      await deleteCallLogs(token, Array.from(selected));
      setSelected(new Set());
      await loadTabData(tab, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk delete failed');
    } finally {
      setDeleting(false);
    }
  };

  if (!token) {
    return (
      <div className="login-page">
        <form className="login-card" onSubmit={handleLogin}>
          <h1>Call Log Sync</h1>
          <p className="subtitle">Enterprise Admin Dashboard</p>
          {error && <div className="error">{error}</div>}
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit">Sign In</button>
        </form>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(totalCalls / PAGE_SIZE));

  return (
    <div className="dashboard">
      <header className="header">
        <div>
          <h1>Call Log Sync Dashboard</h1>
          <p className="header-sub">
            Live monitoring · auto-refresh every {LIVE_INTERVAL_MS / 1000}s
            {lastUpdated && (
              <span className={`live-dot ${livePulse ? 'pulse' : ''}`}>
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div className="header-actions">
          {live && (
            <div className="live-strip">
              <span>{live.callsToday} today</span>
              <span>{live.deletedCalls} deleted</span>
              <span>{live.syncBatchesLastHour} syncs/hr</span>
            </div>
          )}
          <button className="btn-outline" onClick={logout}>Logout</button>
        </div>
      </header>

      {error && <div className="error banner-error">{error}</div>}

      <nav className="tabs">
        {(
          [
            ['overview', 'Overview'],
            ['analytics', 'Analytics'],
            ['calls', 'Call Logs'],
            ['contacts', 'Contacts'],
            ['devices', 'Devices & Debug'],
            ['sync', 'Sync Activity'],
          ] as const
        ).map(([t, label]) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {label}
          </button>
        ))}
      </nav>

      {initialLoading && !stats && <div className="loading">Loading dashboard...</div>}

      {tab === 'overview' && stats && (
        <>
          <div className="stats-grid stats-grid-lg">
            <StatCard label="Total Calls" value={stats.totalCalls} accent />
            <StatCard label="Active on Server" value={stats.activeCalls} />
            <StatCard label="Deleted (from phone)" value={stats.deletedCalls} warn />
            <StatCard label="Deleted Today" value={stats.deletedToday} warn />
            <StatCard label="Calls Today" value={stats.callsToday} />
            <StatCard label="Talk Time" value={formatDuration(stats.totalDurationSeconds)} text />
            <StatCard label="Devices" value={stats.totalDevices} />
            <StatCard label="Active Devices" value={stats.activeDevices} />
            <StatCard label="Sync Batches Today" value={stats.syncBatchesToday} />
            <StatCard label="Sync Failures Today" value={stats.pendingSyncFailures} warn />
          </div>
          <div className="section-gap">
            <ChartsPanel analytics={analytics} />
          </div>
          <div className="panel section-gap">
            <div className="panel-meta">Latest calls (live)</div>
            <CallsTable
              calls={calls.slice(0, 15)}
              devices={devices}
              selected={selected}
              deleting={deleting}
              compact
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
              onDeleteOne={handleDeleteOne}
            />
          </div>
        </>
      )}

      {tab === 'analytics' && <ChartsPanel analytics={analytics} />}

      {tab === 'calls' && (
        <div className="panel">
          <FiltersBar
            search={search}
            onSearchChange={setSearch}
            deviceFilter={deviceFilter}
            onDeviceFilterChange={setDeviceFilter}
            callTypeFilter={callTypeFilter}
            onCallTypeFilterChange={setCallTypeFilter}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            devices={devices}
          />
          <div className="panel-meta panel-meta-actions">
            <span>
              {totalCalls.toLocaleString()} call logs
              {selected.size > 0 && ` · ${selected.size} selected`}
            </span>
            {selected.size > 0 && (
              <button className="btn-danger" disabled={deleting} onClick={handleDeleteSelected}>
                {deleting ? 'Deleting...' : `Delete selected (${selected.size})`}
              </button>
            )}
          </div>
          <CallsTable
            calls={calls}
            devices={devices}
            selected={selected}
            deleting={deleting}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            onDeleteOne={handleDeleteOne}
          />
          <Pagination page={page} totalPages={totalPages} hasMore={hasMore} onPageChange={setPage} />
        </div>
      )}

      {tab === 'contacts' && (
        <div className="panel">
          <div className="panel-toolbar">
            <input
              className="search"
              placeholder="Search phone or contact..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="panel-meta">{totalContacts.toLocaleString()} unique numbers</div>
          <div className="contacts-list">
            {contacts.map((c) => (
              <div key={c.phoneNumber} className="contact-card">
                <button
                  className="contact-header"
                  onClick={() =>
                    setExpandedContact(expandedContact === c.phoneNumber ? null : c.phoneNumber)
                  }
                >
                  <div>
                    <div className="cell-primary">{c.contactName || 'Unknown'}</div>
                    <div className="cell-sub mono">{formatPhoneNumber(c.phoneNumber)}</div>
                  </div>
                  <div className="contact-badges">
                    <span className="pill">{c.callCount} calls</span>
                    <span className="pill incoming">{c.incoming} in</span>
                    <span className="pill outgoing">{c.outgoing} out</span>
                    <span className="pill missed">{c.missed} missed</span>
                    {c.deletedCount > 0 && <span className="pill danger">{c.deletedCount} deleted</span>}
                    <span className="pill muted">{formatDuration(c.totalDuration)}</span>
                  </div>
                </button>
                {expandedContact === c.phoneNumber && (
                  <div className="contact-detail">
                    <p>Last call: {formatCallDateTime(c.lastCallTime)}</p>
                    <p>Devices: {c.devices.join(', ') || '—'}</p>
                    <button
                      className="btn-outline btn-sm"
                      onClick={() => {
                        setSearch(c.phoneNumber);
                        setTab('calls');
                      }}
                    >
                      View all calls →
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <Pagination
            page={contactsPage}
            totalPages={Math.max(1, Math.ceil(totalContacts / PAGE_SIZE))}
            hasMore={hasMoreContacts}
            onPageChange={setContactsPage}
          />
        </div>
      )}

      {tab === 'devices' && (
        <div className="devices-layout">
          <div className="panel">
            <div className="panel-meta">Registered devices — click for permissions & debug</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Device</th>
                    <th>Calls</th>
                    <th>Deleted</th>
                    <th>Last Seen</th>
                    <th>Telemetry</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((d) => (
                    <tr
                      key={d.device_id}
                      className={`clickable-row ${selectedDevice?.device.device_id === d.device_id ? 'selected-row' : ''}`}
                      onClick={() => loadDeviceDetail(d.device_id)}
                    >
                      <td>
                        <div className="cell-primary">{d.device_name || 'Unnamed'}</div>
                        <div className="cell-sub mono">{d.device_id}</div>
                      </td>
                      <td>{d.call_count}</td>
                      <td>{d.deleted_count}</td>
                      <td>{d.last_seen_at ? formatCallDateTime(d.last_seen_at) : 'Never'}</td>
                      <td>{d.telemetry_at ? formatCallDateTime(d.telemetry_at) : '—'}</td>
                      <td>
                        <span className={`badge ${d.is_active ? 'synced' : 'failed'}`}>
                          {d.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {selectedDevice && (
            <div className="panel device-detail-panel">
              <div className="panel-meta">
                {selectedDevice.device.device_name} — permissions & debug
              </div>
              <DeviceDebugPanel device={selectedDevice} />
            </div>
          )}
        </div>
      )}

      {tab === 'sync' && (
        <div className="panel">
          <div className="panel-toolbar">
            <select
              className="filter-select"
              value={deviceFilter}
              onChange={(e) => setDeviceFilter(e.target.value)}
            >
              <option value="">All devices</option>
              {devices.map((d) => (
                <option key={d.device_id} value={d.device_id}>
                  {d.device_name || d.device_id}
                </option>
              ))}
            </select>
          </div>
          <div className="panel-meta">{totalSync.toLocaleString()} sync batches</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Device</th>
                  <th>Batch</th>
                  <th>Synced</th>
                  <th>Failed</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {syncAudit.map((e) => (
                  <tr key={e.id}>
                    <td>{formatCallDateTime(e.createdAt)}</td>
                    <td>
                      <div className="cell-primary">{e.deviceName || e.deviceId.slice(0, 12)}</div>
                    </td>
                    <td>{e.batchSize}</td>
                    <td><span className="badge synced">{e.syncedCount}</span></td>
                    <td>
                      {e.failedCount > 0 ? (
                        <span className="badge failed">{e.failedCount}</span>
                      ) : (
                        '0'
                      )}
                    </td>
                    <td className="mono">{e.ipAddress || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={syncPage}
            totalPages={Math.max(1, Math.ceil(totalSync / PAGE_SIZE))}
            hasMore={hasMoreSync}
            onPageChange={setSyncPage}
          />
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  warn,
  text,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
  warn?: boolean;
  text?: boolean;
}) {
  return (
    <div className={`stat-card ${warn ? 'stat-warn' : ''}`}>
      <div className={`stat-value ${accent ? 'accent' : ''} ${text ? 'stat-text' : ''}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function FiltersBar({
  search,
  onSearchChange,
  deviceFilter,
  onDeviceFilterChange,
  callTypeFilter,
  onCallTypeFilterChange,
  statusFilter,
  onStatusFilterChange,
  devices,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  deviceFilter: string;
  onDeviceFilterChange: (v: string) => void;
  callTypeFilter: string;
  onCallTypeFilterChange: (v: string) => void;
  statusFilter: 'all' | 'active' | 'deleted';
  onStatusFilterChange: (v: 'all' | 'active' | 'deleted') => void;
  devices: DeviceRecord[];
}) {
  return (
    <div className="panel-toolbar">
      <input
        className="search"
        placeholder="Search phone or contact..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <select className="filter-select" value={deviceFilter} onChange={(e) => onDeviceFilterChange(e.target.value)}>
        <option value="">All devices</option>
        {devices.map((d) => (
          <option key={d.device_id} value={d.device_id}>{d.device_name || d.device_id}</option>
        ))}
      </select>
      <select className="filter-select" value={callTypeFilter} onChange={(e) => onCallTypeFilterChange(e.target.value)}>
        <option value="">All types</option>
        {['INCOMING', 'OUTGOING', 'MISSED', 'REJECTED', 'BLOCKED', 'VOICEMAIL'].map((t) => (
          <option key={t} value={t}>{callTypeLabel(t)}</option>
        ))}
      </select>
      <select
        className="filter-select"
        value={statusFilter}
        onChange={(e) => onStatusFilterChange(e.target.value as 'all' | 'active' | 'deleted')}
      >
        <option value="all">All status</option>
        <option value="active">Active only</option>
        <option value="deleted">Deleted from phone</option>
      </select>
    </div>
  );
}

function CallsTable({
  calls,
  selected,
  deleting,
  compact,
  onToggleSelect,
  onToggleSelectAll,
  onDeleteOne,
}: {
  calls: CallLogRecord[];
  devices?: DeviceRecord[];
  selected: Set<string>;
  deleting: boolean;
  compact?: boolean;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onDeleteOne: (id: string) => void;
}) {
  if (calls.length === 0) {
    return (
      <div className="empty-state">
        <p>No call logs found.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {!compact && (
              <th className="col-check">
                <input
                  type="checkbox"
                  checked={calls.length > 0 && selected.size === calls.length}
                  onChange={onToggleSelectAll}
                />
              </th>
            )}
            <th>Contact</th>
            <th>Phone</th>
            <th>Type</th>
            <th>Duration</th>
            {!compact && <th>SIM</th>}
            <th>Device</th>
            <th>Call Time</th>
            <th>Synced</th>
            <th>Status</th>
            {!compact && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {calls.map((c) => (
            <tr key={c.serverId} className={c.isDeleted ? 'row-deleted' : ''}>
              {!compact && (
                <td className="col-check">
                  <input
                    type="checkbox"
                    checked={selected.has(c.serverId)}
                    onChange={() => onToggleSelect(c.serverId)}
                  />
                </td>
              )}
              <td>
                <div className="cell-primary">{c.contactName || 'Unknown'}</div>
                {c.isDeleted && c.deletedAt && (
                  <div className="cell-sub">Removed {formatCallDateTime(c.deletedAt)}</div>
                )}
              </td>
              <td className="mono">{formatPhoneNumber(c.phoneNumber)}</td>
              <td>
                <span className={`badge ${callTypeBadgeClass(c.callType)}`}>
                  {callTypeLabel(c.callType)}
                </span>
              </td>
              <td>{formatDuration(c.duration)}</td>
              {!compact && <td>{formatSimSlot(c.simSlot)}</td>}
              <td>
                <div className="cell-primary">{c.deviceName || 'Device'}</div>
                <div className="cell-sub mono">{c.deviceId.slice(0, 10)}…</div>
              </td>
              <td>{formatCallDateTime(c.callTime)}</td>
              <td>
                <div className="cell-primary">{formatCallDateTime(c.syncedAt)}</div>
                <div className="cell-sub">#{c.androidId}</div>
              </td>
              <td>
                {c.isDeleted ? (
                  <span className="badge deleted">Deleted</span>
                ) : (
                  <span className="badge synced">Active</span>
                )}
              </td>
              {!compact && (
                <td>
                  <button className="btn-danger-sm" disabled={deleting} onClick={() => onDeleteOne(c.serverId)}>
                    Delete
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeviceDebugPanel({ device }: { device: DeviceDetail }) {
  const t = device.device.telemetry ?? {};
  const permissions = (t.permissions ?? {}) as Record<string, boolean>;
  const pluginStatus = (t.pluginStatus ?? {}) as Record<string, unknown>;
  const sqliteDebug = (t.sqliteDebug ?? t.syncStatus ?? {}) as Record<string, unknown>;

  return (
    <div className="debug-panel">
      <div className="debug-section">
        <h4>Device summary</h4>
        <dl className="debug-dl">
          <dt>Device ID</dt><dd className="mono">{device.device.device_id}</dd>
          <dt>Calls synced</dt><dd>{device.device.call_count} ({device.device.active_count} active, {device.device.deleted_count} deleted)</dd>
          <dt>Last seen</dt><dd>{device.device.last_seen_at ? formatCallDateTime(device.device.last_seen_at) : '—'}</dd>
          <dt>Telemetry</dt><dd>{device.device.telemetry_at ? formatCallDateTime(device.device.telemetry_at) : 'Not reported yet'}</dd>
          <dt>App version</dt><dd>{String(t.appVersion ?? '—')}</dd>
          <dt>Platform</dt><dd>{String(t.platform ?? '—')} {String(t.osVersion ?? '')}</dd>
          <dt>Network</dt><dd>{t.networkConnected ? 'Connected' : 'Offline'}</dd>
        </dl>
      </div>

      <div className="debug-section">
        <h4>Permissions</h4>
        <div className="perm-grid">
          {Object.entries(permissions).map(([key, granted]) => (
            <div key={key} className={`perm-item ${granted ? 'granted' : 'denied'}`}>
              <span>{key.replace(/([A-Z])/g, ' $1').trim()}</span>
              <span className={`badge ${granted ? 'synced' : 'failed'}`}>{granted ? 'Granted' : 'Denied'}</span>
            </div>
          ))}
          {Object.keys(permissions).length === 0 && <p className="muted">Open mobile app to report permissions</p>}
        </div>
      </div>

      <div className="debug-section">
        <h4>Plugin / observer status</h4>
        <pre className="debug-json">{JSON.stringify(pluginStatus, null, 2)}</pre>
      </div>

      <div className="debug-section">
        <h4>SQLite / sync debug</h4>
        <pre className="debug-json">{JSON.stringify(sqliteDebug, null, 2)}</pre>
      </div>

      <div className="debug-section">
        <h4>Recent calls on device</h4>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Phone</th><th>Type</th><th>Duration</th><th>Time</th><th>Status</th></tr>
            </thead>
            <tbody>
              {device.recentCalls.map((c) => (
                <tr key={c.serverId} className={c.isDeleted ? 'row-deleted' : ''}>
                  <td className="mono">{formatPhoneNumber(c.phoneNumber)}</td>
                  <td><span className={`badge ${callTypeBadgeClass(c.callType)}`}>{callTypeLabel(c.callType)}</span></td>
                  <td>{formatDuration(c.duration)}</td>
                  <td>{formatCallDateTime(c.callTime)}</td>
                  <td>{c.isDeleted ? <span className="badge deleted">Deleted</span> : <span className="badge synced">Active</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  hasMore,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  hasMore: boolean;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1 && !hasMore) return null;
  return (
    <div className="pagination">
      <button className="btn-outline" disabled={page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))}>
        Previous
      </button>
      <span>Page {page} of {totalPages}</span>
      <button className="btn-outline" disabled={!hasMore} onClick={() => onPageChange(page + 1)}>
        Next
      </button>
    </div>
  );
}
