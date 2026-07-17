import { useCallback, useEffect, useState } from 'react';
import {
  login,
  fetchStats,
  fetchAnalytics,
  fetchCallLogs,
  fetchContacts,
  fetchDevices,
  fetchDeviceDetail,
  fetchSyncAudit,
  deleteCallLog,
  deleteCallLogs,
  updateCallLog,
  updateContact,
  deleteCallsByPhone,
  deleteContactCallsBulk,
  updateDevice,
  deleteDevice,
  deleteDevices,
  deleteSyncAuditEntry,
  deleteSyncAuditEntries,
  DashboardStats,
  Analytics,
  CallLogRecord,
  ContactGroup,
  DeviceRecord,
  DeviceDetail,
  SyncAuditEntry,
  CallLogUpdate,
} from './api';
import { ChartsPanel } from './components/ChartsPanel';
import { CallEditModal } from './components/CallEditModal';
import { ContactEditModal } from './components/ContactEditModal';
import { DeviceEditModal } from './components/DeviceEditModal';
import { DeviceDebugPanel } from './components/DeviceDebugPanel';
import { ConfirmDeleteModal } from './components/ConfirmDeleteModal';
import { RowActions } from './components/RowActions';
import type { ConfirmDeletePayload } from './utils/deleteConfirm';
import {
  buildCallDeleteConfirm,
  buildCallsBulkDeleteConfirm,
  buildContactDeleteConfirm,
  buildContactsBulkDeleteConfirm,
  buildDeviceDeleteConfirm,
  buildDevicesBulkDeleteConfirm,
  buildDeviceCallsBulkDeleteConfirm,
  buildSyncAuditDeleteConfirm,
  buildSyncAuditBulkDeleteConfirm,
} from './utils/deleteConfirm';
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

type PendingDelete = {
  payload: ConfirmDeletePayload;
  execute: () => Promise<void>;
};

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [email, setEmail] = useState('admin@enterprise.com');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<DashboardStats | null>(null);
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
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [selectedSync, setSelectedSync] = useState<Set<number>>(new Set());
  const [selectedDeviceCalls, setSelectedDeviceCalls] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingCall, setEditingCall] = useState<CallLogRecord | null>(null);
  const [editingContact, setEditingContact] = useState<ContactGroup | null>(null);
  const [editingDevice, setEditingDevice] = useState<DeviceRecord | null>(null);
  const [expandedContact, setExpandedContact] = useState<string | null>(null);

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
    setSelectedContacts(new Set());
  }, [debouncedSearch, deviceFilter, callTypeFilter, statusFilter]);

  useEffect(() => {
    setSelected(new Set());
  }, [page]);

  useEffect(() => {
    setSelectedContacts(new Set());
  }, [contactsPage, debouncedSearch]);

  useEffect(() => {
    setSelectedSync(new Set());
  }, [syncPage, deviceFilter]);

  useEffect(() => {
    setSelectedDevices(new Set());
  }, [tab]);

  useEffect(() => {
    setSelectedDeviceCalls(new Set());
  }, [selectedDevice?.device.device_id]);

  const loadTabData = useCallback(
    async (currentTab: Tab, silent = false) => {
      if (!token) return;
      if (!silent) setInitialLoading(true);
      setError('');
      try {
        if (currentTab === 'overview') {
          const [s, d, a, c] = await Promise.all([
            fetchStats(token),
            fetchDevices(token),
            fetchAnalytics(token),
            fetchCallLogs(token, page, {
              search: debouncedSearch,
              deviceId: deviceFilter,
              callType: callTypeFilter || undefined,
              deletedOnly: statusFilter === 'deleted',
              activeOnly: statusFilter === 'active',
            }),
          ]);
          setStats(s);
          setDevices(d.devices);
          setAnalytics(a);
          setCalls(c.calls);
          setTotalCalls(c.total);
          setHasMore(c.hasMore);
        } else if (currentTab === 'analytics') {
          setAnalytics(await fetchAnalytics(token));
        } else if (currentTab === 'calls') {
          const [d, c] = await Promise.all([
            fetchDevices(token),
            fetchCallLogs(token, page, {
              search: debouncedSearch,
              deviceId: deviceFilter,
              callType: callTypeFilter || undefined,
              deletedOnly: statusFilter === 'deleted',
              activeOnly: statusFilter === 'active',
            }),
          ]);
          setDevices(d.devices);
          setCalls(c.calls);
          setTotalCalls(c.total);
          setHasMore(c.hasMore);
        } else if (currentTab === 'contacts') {
          const cg = await fetchContacts(token, contactsPage, debouncedSearch);
          setContacts(cg.contacts);
          setTotalContacts(cg.total);
          setHasMoreContacts(cg.hasMore);
        } else if (currentTab === 'devices') {
          setDevices((await fetchDevices(token)).devices);
        } else if (currentTab === 'sync') {
          const [d, sa] = await Promise.all([
            fetchDevices(token),
            fetchSyncAudit(token, syncPage, deviceFilter),
          ]);
          setDevices(d.devices);
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

  const openDeleteConfirm = (payload: ConfirmDeletePayload, execute: () => Promise<void>) => {
    setPendingDelete({ payload, execute });
  };

  const runPendingDelete = async () => {
    if (!token || !pendingDelete) return;
    setDeleting(true);
    setError('');
    try {
      await pendingDelete.execute();
      setPendingDelete(null);
      if (selectedDevice?.device.device_id) {
        await loadDeviceDetail(selectedDevice.device.device_id);
      }
      await loadTabData(tab, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

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

  const overviewCalls = calls.slice(0, 15);

  const toggleSelectOverview = (serverId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(serverId)) next.delete(serverId);
      else next.add(serverId);
      return next;
    });
  };

  const toggleSelectAllOverview = () => {
    const ids = overviewCalls.map((c) => c.serverId);
    const allSelected = ids.length > 0 && ids.every((id) => selected.has(id));
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelected((prev) => new Set([...prev, ...ids]));
    }
  };

  const toggleSelectDevice = (deviceId: string) => {
    setSelectedDevices((prev) => {
      const next = new Set(prev);
      if (next.has(deviceId)) next.delete(deviceId);
      else next.add(deviceId);
      return next;
    });
  };

  const toggleSelectAllDevices = () => {
    if (selectedDevices.size === devices.length) setSelectedDevices(new Set());
    else setSelectedDevices(new Set(devices.map((d) => d.device_id)));
  };

  const toggleSelectContact = (phone: string) => {
    setSelectedContacts((prev) => {
      const next = new Set(prev);
      if (next.has(phone)) next.delete(phone);
      else next.add(phone);
      return next;
    });
  };

  const toggleSelectAllContacts = () => {
    if (selectedContacts.size === contacts.length) setSelectedContacts(new Set());
    else setSelectedContacts(new Set(contacts.map((c) => c.phoneNumber)));
  };

  const toggleSelectSync = (id: number) => {
    const numId = Number(id);
    setSelectedSync((prev) => {
      const next = new Set(prev);
      if (next.has(numId)) next.delete(numId);
      else next.add(numId);
      return next;
    });
  };

  const toggleSelectAllSync = () => {
    if (selectedSync.size === syncAudit.length) setSelectedSync(new Set());
    else setSelectedSync(new Set(syncAudit.map((e) => e.id)));
  };

  const toggleSelectDeviceCall = (serverId: string) => {
    setSelectedDeviceCalls((prev) => {
      const next = new Set(prev);
      if (next.has(serverId)) next.delete(serverId);
      else next.add(serverId);
      return next;
    });
  };

  const toggleSelectAllDeviceCalls = (recentCalls: CallLogRecord[]) => {
    if (selectedDeviceCalls.size === recentCalls.length) setSelectedDeviceCalls(new Set());
    else setSelectedDeviceCalls(new Set(recentCalls.map((c) => c.serverId)));
  };

  const requestDeleteCall = (call: CallLogRecord) => {
    if (!token) return;
    openDeleteConfirm(buildCallDeleteConfirm(call), async () => {
      await deleteCallLog(token, call.serverId);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(call.serverId);
        return next;
      });
      setSelectedDeviceCalls((prev) => {
        const next = new Set(prev);
        next.delete(call.serverId);
        return next;
      });
    });
  };

  const requestDeleteCalls = (callList: CallLogRecord[]) => {
    if (!token || callList.length === 0) return;
    openDeleteConfirm(buildCallsBulkDeleteConfirm(callList), async () => {
      await deleteCallLogs(token, callList.map((c) => c.serverId));
      const ids = new Set(callList.map((c) => c.serverId));
      setSelected((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      setSelectedDeviceCalls((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    });
  };

  const requestDeleteSelectedCalls = () => {
    const callList = calls.filter((c) => selected.has(c.serverId));
    requestDeleteCalls(callList);
  };

  const requestDeleteOverviewSelected = () => {
    const callList = overviewCalls.filter((c) => selected.has(c.serverId));
    requestDeleteCalls(callList);
  };

  const requestDeleteContact = (contact: ContactGroup) => {
    if (!token) return;
    openDeleteConfirm(buildContactDeleteConfirm(contact), async () => {
      await deleteCallsByPhone(token, contact.phoneNumber);
      setSelectedContacts((prev) => {
        const next = new Set(prev);
        next.delete(contact.phoneNumber);
        return next;
      });
    });
  };

  const requestDeleteSelectedContacts = () => {
    if (!token) return;
    const list = contacts.filter((c) => selectedContacts.has(c.phoneNumber));
    openDeleteConfirm(buildContactsBulkDeleteConfirm(list), async () => {
      await deleteContactCallsBulk(token, list.map((c) => c.phoneNumber));
      setSelectedContacts(new Set());
    });
  };

  const requestDeleteDevice = (device: DeviceRecord) => {
    if (!token) return;
    const detail =
      selectedDevice?.device.device_id === device.device_id ? selectedDevice : null;
    openDeleteConfirm(buildDeviceDeleteConfirm(device, detail), async () => {
      await deleteDevice(token, device.device_id);
      if (selectedDevice?.device.device_id === device.device_id) {
        setSelectedDevice(null);
      }
      setSelectedDevices((prev) => {
        const next = new Set(prev);
        next.delete(device.device_id);
        return next;
      });
    });
  };

  const requestDeleteSelectedDevices = () => {
    if (!token) return;
    const list = devices.filter((d) => selectedDevices.has(d.device_id));
    openDeleteConfirm(buildDevicesBulkDeleteConfirm(list), async () => {
      await deleteDevices(token, list.map((d) => d.device_id));
      if (selectedDevice && selectedDevices.has(selectedDevice.device.device_id)) {
        setSelectedDevice(null);
      }
      setSelectedDevices(new Set());
    });
  };

  const requestDeleteSyncAudit = (entry: SyncAuditEntry) => {
    if (!token) return;
    openDeleteConfirm(buildSyncAuditDeleteConfirm(entry), async () => {
      await deleteSyncAuditEntry(token, entry.id);
      setSelectedSync((prev) => {
        const next = new Set(prev);
        next.delete(entry.id);
        return next;
      });
    });
  };

  const requestDeleteSelectedSync = () => {
    if (!token) return;
    const list = syncAudit.filter((e) => selectedSync.has(e.id));
    openDeleteConfirm(buildSyncAuditBulkDeleteConfirm(list), async () => {
      await deleteSyncAuditEntries(token, list.map((e) => Number(e.id)));
      setSelectedSync(new Set());
    });
  };

  const requestDeleteDeviceCalls = (callList: CallLogRecord[], deviceName: string) => {
    if (!token || callList.length === 0) return;
    openDeleteConfirm(buildDeviceCallsBulkDeleteConfirm(callList, deviceName), async () => {
      await deleteCallLogs(token, callList.map((c) => c.serverId));
      const ids = new Set(callList.map((c) => c.serverId));
      setSelectedDeviceCalls((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    });
  };

  const handleSaveCall = async (patch: CallLogUpdate) => {
    if (!token || !editingCall) return;
    setSaving(true);
    try {
      await updateCallLog(token, editingCall.serverId, patch);
      setEditingCall(null);
      if (selectedDevice?.device.device_id) {
        await loadDeviceDetail(selectedDevice.device.device_id);
      }
      await loadTabData(tab, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteContactCalls = (contact: ContactGroup) => {
    requestDeleteContact(contact);
  };

  const handleSaveContact = async (contactName: string) => {
    if (!token || !editingContact) return;
    setSaving(true);
    try {
      await updateContact(token, editingContact.phoneNumber, contactName);
      setEditingContact(null);
      await loadTabData(tab, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDevice = async (patch: { deviceName?: string; isActive?: boolean }) => {
    if (!token || !editingDevice) return;
    setSaving(true);
    try {
      await updateDevice(token, editingDevice.device_id, patch);
      const deviceId = editingDevice.device_id;
      setEditingDevice(null);
      await loadTabData(tab, true);
      if (selectedDevice?.device.device_id === deviceId) {
        await loadDeviceDetail(deviceId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDevice = (device: DeviceRecord) => {
    requestDeleteDevice(device);
  };

  const handleDeleteSyncAudit = (entry: SyncAuditEntry) => {
    requestDeleteSyncAudit(entry);
  };

  const contactFromTopNumber = (n: Analytics['topNumbers'][0]): ContactGroup => ({
    phoneNumber: n.phoneNumber,
    contactName: n.contactName,
    callCount: n.callCount,
    incoming: 0,
    outgoing: 0,
    missed: 0,
    deletedCount: n.deletedCount,
    activeCount: n.callCount - n.deletedCount,
    isActive: n.callCount - n.deletedCount > 0,
    totalDuration: n.totalDuration,
    lastCallTime: n.lastCallTime,
    devices: [],
  });

  const overviewSelectedCount = overviewCalls.filter((c) => selected.has(c.serverId)).length;

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
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <div className="brand-mark">CL</div>
          <div>
            <h1>Call Log Sync</h1>
            <p className="header-sub">
              Enterprise admin
              {lastUpdated && (
                <span className={`live-dot ${livePulse ? 'pulse' : ''}`}>
                  Updated {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="topbar-stats">
          {stats && (
            <>
              <div className="stat-pill"><strong>{stats.callsToday}</strong> today</div>
              <div className="stat-pill"><strong>{stats.deletedCalls}</strong> deleted</div>
              <div className="stat-pill"><strong>{stats.syncBatchesToday}</strong> syncs</div>
            </>
          )}
        </div>
        <div className="topbar-actions">
          <button className="btn-outline btn-sm" type="button" onClick={() => loadTabData(tab, false)}>
            Refresh
          </button>
          <button className="btn-outline btn-sm" type="button" onClick={logout}>Logout</button>
        </div>
      </header>

      {error && <div className="error banner-error">{error}</div>}

      <nav className="tabs" aria-label="Dashboard sections">
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

      <main className="main-content">
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
            <ChartsPanel
              analytics={analytics}
              onEditContact={(n) => setEditingContact(contactFromTopNumber(n))}
              onDeleteContact={(n) => handleDeleteContactCalls(contactFromTopNumber(n))}
              actionDisabled={deleting || saving}
            />
          </div>
          <div className="panel section-gap">
            <div className="panel-meta panel-meta-actions">
              <span className="panel-meta-title-inline">Latest calls</span>
              {overviewSelectedCount > 0 && (
                <button
                  className="btn-danger btn-sm"
                  disabled={deleting}
                  onClick={requestDeleteOverviewSelected}
                >
                  Delete selected ({overviewSelectedCount})
                </button>
              )}
            </div>
            <CallsTable
              calls={overviewCalls}
              devices={devices}
              selected={selected}
              deleting={deleting}
              compact
              selectable
              onToggleSelect={toggleSelectOverview}
              onToggleSelectAll={toggleSelectAllOverview}
              onEditOne={setEditingCall}
              onDeleteOne={requestDeleteCall}
            />
          </div>
        </>
      )}

      {tab === 'analytics' && (
        <ChartsPanel
          analytics={analytics}
          onEditContact={(n) => setEditingContact(contactFromTopNumber(n))}
          onDeleteContact={(n) => handleDeleteContactCalls(contactFromTopNumber(n))}
          actionDisabled={deleting || saving}
        />
      )}

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
              <button className="btn-danger" disabled={deleting} onClick={requestDeleteSelectedCalls}>
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
            onEditOne={setEditingCall}
            onDeleteOne={requestDeleteCall}
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
          <div className="panel-meta panel-meta-actions">
            <span>{totalContacts.toLocaleString()} unique numbers</span>
            {contacts.length > 0 && (
              <label className="select-all-inline">
                <input
                  type="checkbox"
                  checked={contacts.length > 0 && selectedContacts.size === contacts.length}
                  onChange={toggleSelectAllContacts}
                />
                Select all on page
              </label>
            )}
            {selectedContacts.size > 0 && (
              <button className="btn-danger btn-sm" disabled={deleting} onClick={requestDeleteSelectedContacts}>
                Delete selected ({selectedContacts.size})
              </button>
            )}
          </div>
          <div className="contacts-list">
            {contacts.map((c) => (
              <div key={c.phoneNumber} className="contact-card">
                <div className="contact-header-row">
                  <input
                    type="checkbox"
                    className="contact-check"
                    checked={selectedContacts.has(c.phoneNumber)}
                    onChange={() => toggleSelectContact(c.phoneNumber)}
                    onClick={(e) => e.stopPropagation()}
                  />
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
                      {!c.isActive && c.callCount > 0 && (
                        <span className="pill muted">Inactive (all deleted)</span>
                      )}
                      {c.isActive && c.activeCount > 0 && (
                        <span className="pill synced">{c.activeCount} active</span>
                      )}
                      <span className="pill muted">{formatDuration(c.totalDuration)}</span>
                    </div>
                  </button>
                  <RowActions
                    onEdit={() => setEditingContact(c)}
                    onDelete={() => handleDeleteContactCalls(c)}
                    disabled={deleting || saving}
                  />
                </div>
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
          <div className="panel panel-fill">
            <div className="panel-meta panel-meta-actions">
              <span className="panel-meta-title-inline">
                Registered devices
                <span className="panel-meta-hint">Select a device to view permissions & debug</span>
              </span>
              {selectedDevices.size > 0 && (
                <button className="btn-danger btn-sm" disabled={deleting} onClick={requestDeleteSelectedDevices}>
                  Delete selected ({selectedDevices.size})
                </button>
              )}
            </div>
            <div className="table-wrap table-wrap-fit">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="col-check">
                      <input
                        type="checkbox"
                        checked={devices.length > 0 && selectedDevices.size === devices.length}
                        onChange={toggleSelectAllDevices}
                      />
                    </th>
                    <th>Device</th>
                    <th>Calls</th>
                    <th>Deleted</th>
                    <th>Last Seen</th>
                    <th>Telemetry</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((d) => (
                    <tr
                      key={d.device_id}
                      className={`clickable-row ${selectedDevice?.device.device_id === d.device_id ? 'selected-row' : ''}`}
                      onClick={() => loadDeviceDetail(d.device_id)}
                    >
                      <td className="col-check" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedDevices.has(d.device_id)}
                          onChange={() => toggleSelectDevice(d.device_id)}
                        />
                      </td>
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
                      <td>
                        <RowActions
                          onEdit={() => setEditingDevice(d)}
                          onDelete={() => handleDeleteDevice(d)}
                          disabled={deleting || saving}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel panel-fill device-detail-panel">
            {selectedDevice ? (
              <>
                <div className="panel-meta panel-meta-actions">
                  <span className="panel-meta-title-inline">
                    {selectedDevice.device.device_name}
                    <span className="panel-meta-hint">Permissions & debug</span>
                  </span>
                  <button
                    type="button"
                    className="btn-outline btn-sm"
                    onClick={() => loadDeviceDetail(selectedDevice.device.device_id)}
                  >
                    Reload debug
                  </button>
                </div>
                <DeviceDebugPanel
                  device={selectedDevice}
                  deleting={deleting}
                  selectedDeviceCalls={selectedDeviceCalls}
                  onToggleDeviceCall={toggleSelectDeviceCall}
                  onToggleAllDeviceCalls={toggleSelectAllDeviceCalls}
                  onDeleteSelectedDeviceCalls={() => {
                    const list = selectedDevice.recentCalls.filter((c) =>
                      selectedDeviceCalls.has(c.serverId)
                    );
                    requestDeleteDeviceCalls(list, selectedDevice.device.device_name);
                  }}
                  onEditDevice={() => {
                    const d = devices.find((x) => x.device_id === selectedDevice.device.device_id);
                    if (d) setEditingDevice(d);
                  }}
                  onDeleteDevice={() => {
                    const d = devices.find((x) => x.device_id === selectedDevice.device.device_id);
                    if (d) handleDeleteDevice(d);
                  }}
                  onEditCall={setEditingCall}
                  onDeleteCall={requestDeleteCall}
                />
              </>
            ) : (
              <div className="detail-placeholder">
                <div className="detail-placeholder-icon">📱</div>
                <h3>Select a device</h3>
                <p>Click a row on the left to view permissions, plugin status, SQLite debug info, and recent calls.</p>
              </div>
            )}
          </div>
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
          <div className="panel-meta panel-meta-actions">
            <span>{totalSync.toLocaleString()} sync batches</span>
            {selectedSync.size > 0 && (
              <button className="btn-danger btn-sm" disabled={deleting} onClick={requestDeleteSelectedSync}>
                Delete selected ({selectedSync.size})
              </button>
            )}
          </div>
          <div className="table-wrap">
            <table className="data-table table-wide">
              <thead>
                <tr>
                  <th className="col-check">
                    <input
                      type="checkbox"
                      checked={syncAudit.length > 0 && selectedSync.size === syncAudit.length}
                      onChange={toggleSelectAllSync}
                    />
                  </th>
                  <th>Time</th>
                  <th>Device</th>
                  <th>Batch</th>
                  <th>Synced</th>
                  <th>Failed</th>
                  <th>IP</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {syncAudit.map((e) => (
                  <tr key={e.id}>
                    <td className="col-check">
                      <input
                        type="checkbox"
                        checked={selectedSync.has(e.id)}
                        onChange={() => toggleSelectSync(e.id)}
                      />
                    </td>
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
                    <td>
                      <RowActions
                        onDelete={() => handleDeleteSyncAudit(e)}
                        disabled={deleting}
                      />
                    </td>
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
      </main>

      {editingCall && (
        <CallEditModal
          call={editingCall}
          saving={saving}
          onClose={() => setEditingCall(null)}
          onSave={handleSaveCall}
        />
      )}
      {editingContact && (
        <ContactEditModal
          contact={editingContact}
          saving={saving}
          onClose={() => setEditingContact(null)}
          onSave={handleSaveContact}
        />
      )}
      {editingDevice && (
        <DeviceEditModal
          device={editingDevice}
          saving={saving}
          onClose={() => setEditingDevice(null)}
          onSave={handleSaveDevice}
        />
      )}
      {pendingDelete && (
        <ConfirmDeleteModal
          payload={pendingDelete.payload}
          deleting={deleting}
          onClose={() => !deleting && setPendingDelete(null)}
          onConfirm={runPendingDelete}
        />
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
  selectable,
  onToggleSelect,
  onToggleSelectAll,
  onEditOne,
  onDeleteOne,
}: {
  calls: CallLogRecord[];
  devices?: DeviceRecord[];
  selected: Set<string>;
  deleting: boolean;
  compact?: boolean;
  selectable?: boolean;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onEditOne: (call: CallLogRecord) => void;
  onDeleteOne: (call: CallLogRecord) => void;
}) {
  if (calls.length === 0) {
    return (
      <div className="empty-state">
        <p>No call logs found.</p>
      </div>
    );
  }

  const showCheckboxes = !compact || selectable;
  const pageSelectedCount = calls.filter((c) => selected.has(c.serverId)).length;

  return (
    <div className="table-wrap">
      <table className="data-table table-wide">
        <thead>
          <tr>
            {showCheckboxes && (
              <th className="col-check">
                <input
                  type="checkbox"
                  checked={calls.length > 0 && pageSelectedCount === calls.length}
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
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {calls.map((c) => (
            <tr key={c.serverId} className={c.isDeleted ? 'row-deleted' : ''}>
              {showCheckboxes && (
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
              <td>
                <RowActions
                  compact={compact}
                  onEdit={() => onEditOne(c)}
                  onDelete={() => onDeleteOne(c)}
                  disabled={deleting}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
