import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, BarChart3, LayoutDashboard, Smartphone, ArrowLeft } from 'lucide-react';
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
import { LoginPage } from './components/LoginPage';
import { DashboardLayout, type DashboardTab } from './components/layout/DashboardLayout';
import { Badge, callTypeToBadgeVariant } from './components/ui/Badge';
import { Button, inputClassName, selectClassName } from './components/ui/Button';
import { Panel, PanelHeader, PanelToolbar, SectionHeading, StatCard, tableClass, tableWrapClass, theadClass, thClass, tdClass, trHoverClass } from './components/ui/Panel';
import {
  ChartsSkeleton,
  ContactsListSkeleton,
  DevicesLayoutSkeleton,
  OverviewSkeleton,
  PanelSkeleton,
} from './components/ui/Skeleton';
import { useToast } from './components/ui/Toast';
import { LoadingOverlay } from './components/ui/LoadingOverlay';
import { cn } from './lib/cn';
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
  callTypeLabel,
  formatCallDateTime,
  formatDuration,
  formatPhoneNumber,
  formatSimSlot,
} from './utils/format';

const PAGE_SIZE = 50;

type LoadOptions = {
  silent?: boolean;
  notifySuccess?: boolean;
};

type PendingDelete = {
  payload: ConfirmDeletePayload;
  execute: () => Promise<void>;
};

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [email, setEmail] = useState('admin@enterprise.com');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [tab, setTab] = useState<DashboardTab>('calls');
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
  const [tabLoading, setTabLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [loadedTabs, setLoadedTabs] = useState<Set<DashboardTab>>(new Set());
  const loadedTabsRef = useRef<Set<DashboardTab>>(new Set());
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
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const toast = useToast();

  /** Skeleton only on first visit to a tab — never during refetch/pagination. */
  const showSkeleton = tabLoading && !loadedTabs.has(tab);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoginLoading(true);
    try {
      const result = await login(email, password);
      if (result.role !== 'admin') {
        setError('Admin role required');
        toast.error('Admin role required');
        return;
      }
      localStorage.setItem('token', result.token);
      setToken(result.token);
      toast.success('Signed in successfully');
    } catch {
      setError('Invalid credentials');
      toast.error('Invalid email or password');
    } finally {
      setLoginLoading(false);
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
    async (currentTab: DashboardTab, options: LoadOptions = {}) => {
      const { silent = false, notifySuccess = false } = options;
      if (!token) return;

      const cached = loadedTabsRef.current.has(currentTab);

      if (silent) {
        // Background refresh after mutations — no loading UI
      } else if (notifySuccess) {
        setRefreshing(true);
      } else if (cached) {
        setFetching(true);
      } else {
        setTabLoading(true);
      }

      setError('');
      try {
        if (currentTab === 'overview') {
          const [s, d, c] = await Promise.all([
            fetchStats(token),
            fetchDevices(token),
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
        loadedTabsRef.current.add(currentTab);
        setLoadedTabs(new Set(loadedTabsRef.current));
        if (notifySuccess) toast.success('Dashboard refreshed successfully');
      } catch {
        toast.error('Failed to load dashboard data');
      } finally {
        setTabLoading(false);
        setFetching(false);
        if (notifySuccess) setRefreshing(false);
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
      toast,
    ]
  );

  const loadDeviceDetail = useCallback(
    async (deviceId: string) => {
      if (!token) return;
      setDeviceLoading(true);
      try {
        const detail = await fetchDeviceDetail(token, deviceId);
        setSelectedDevice(detail);
      } catch {
        toast.error('Failed to load device details');
      } finally {
        setDeviceLoading(false);
      }
    },
    [token, toast]
  );

  useEffect(() => {
    loadTabData(tab);
  }, [tab, page, contactsPage, syncPage, debouncedSearch, deviceFilter, callTypeFilter, statusFilter, token]);

  useEffect(() => {
    if (tab !== 'devices' || devices.length === 0 || selectedDevice) return;
    const mq = window.matchMedia('(min-width: 1024px)');
    if (mq.matches) {
      loadDeviceDetail(devices[0].device_id);
    }
  }, [tab, devices, selectedDevice, loadDeviceDetail]);

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
      await loadTabData(tab, { silent: true });
      toast.success('Deleted successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
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
      await loadTabData(tab, { silent: true });
      toast.success('Call log updated successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
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
      await loadTabData(tab, { silent: true });
      toast.success('Contact updated successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
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
      await loadTabData(tab, { silent: true });
      if (selectedDevice?.device.device_id === deviceId) {
        await loadDeviceDetail(deviceId);
      }
      toast.success('Device updated successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
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
      <LoginPage
        email={email}
        password={password}
        error={error}
        loading={loginLoading}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onSubmit={handleLogin}
      />
    );
  }

  const totalPages = Math.max(1, Math.ceil(totalCalls / PAGE_SIZE));

  return (
    <>
    <DashboardLayout
      tab={tab}
      onTabChange={setTab}
      onLogout={logout}
      onRefresh={() => loadTabData(tab, { notifySuccess: true })}
      lastUpdated={lastUpdated}
      livePulse={livePulse}
      stats={stats}
      refreshing={refreshing}
      fetching={fetching}
    >
      {tab === 'overview' && showSkeleton && <OverviewSkeleton />}

      {tab === 'overview' && loadedTabs.has('overview') && stats && (
        <div className={cn('relative transition-opacity duration-200', fetching && 'opacity-80')}>
          <LoadingOverlay active={fetching} />
          <SectionHeading
            icon={LayoutDashboard}
            title="Dashboard Summary"
            description="Key metrics across all devices and synced call logs"
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
          <Panel className="mt-4">
            <PanelHeader
              title="Latest Call Logs"
              hint="Most recently synced calls across all devices"
              actions={
                overviewSelectedCount > 0 ? (
                  <Button variant="danger" size="sm" disabled={deleting} onClick={requestDeleteOverviewSelected}>
                    Delete selected ({overviewSelectedCount})
                  </Button>
                ) : undefined
              }
            />
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
          </Panel>
        </div>
      )}

      {tab === 'analytics' && showSkeleton && <ChartsSkeleton />}

      {tab === 'analytics' && loadedTabs.has('analytics') && (
        <div className={cn('relative transition-opacity duration-200', fetching && 'opacity-80')}>
          <LoadingOverlay active={fetching} />
          <SectionHeading
            icon={BarChart3}
            title="Analytics"
            description="Call trends, device activity, and top contacts"
          />
          <ChartsPanel
          analytics={analytics}
          onEditContact={(n) => setEditingContact(contactFromTopNumber(n))}
          onDeleteContact={(n) => handleDeleteContactCalls(contactFromTopNumber(n))}
          actionDisabled={deleting || saving}
        />
        </div>
      )}

      {tab === 'calls' && showSkeleton && <PanelSkeleton withToolbar />}

      {tab === 'calls' && loadedTabs.has('calls') && (
        <div className={cn('relative transition-opacity duration-200', fetching && 'opacity-80')}>
          <LoadingOverlay active={fetching} />
        <Panel>
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
          <PanelHeader
            title={`${totalCalls.toLocaleString()} call logs${selected.size > 0 ? ` · ${selected.size} selected` : ''}`}
            actions={
              selected.size > 0 ? (
                <Button variant="danger" size="sm" disabled={deleting} onClick={requestDeleteSelectedCalls}>
                  {deleting ? 'Deleting...' : `Delete selected (${selected.size})`}
                </Button>
              ) : undefined
            }
          />
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
        </Panel>
        </div>
      )}

      {tab === 'contacts' && showSkeleton && (
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/50">
          <div className="border-b border-slate-800 px-4 py-3">
            <div className="h-9 max-w-md animate-pulse rounded-lg bg-slate-800/80" />
          </div>
          <ContactsListSkeleton />
        </div>
      )}

      {tab === 'contacts' && loadedTabs.has('contacts') && (
        <div className={cn('relative transition-opacity duration-200', fetching && 'opacity-80')}>
          <LoadingOverlay active={fetching} />
        <Panel>
          <PanelToolbar>
            <input
              className={inputClassName}
              placeholder="Search phone or contact..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </PanelToolbar>
          <PanelHeader
            title={`${totalContacts.toLocaleString()} unique numbers`}
            actions={
              <>
                {contacts.length > 0 && (
                  <label className="inline-flex items-center gap-2 text-xs text-slate-400">
                    <input
                      type="checkbox"
                      className="rounded border-slate-600"
                      checked={contacts.length > 0 && selectedContacts.size === contacts.length}
                      onChange={toggleSelectAllContacts}
                    />
                    Select all on page
                  </label>
                )}
                {selectedContacts.size > 0 && (
                  <Button variant="danger" size="sm" disabled={deleting} onClick={requestDeleteSelectedContacts}>
                    Delete selected ({selectedContacts.size})
                  </Button>
                )}
              </>
            }
          />
          <div className="space-y-1.5 p-2">
            {contacts.map((c) => (
              <div key={c.phoneNumber} className="overflow-hidden rounded-lg border border-slate-800/80 bg-slate-950/40">
                <div className="flex items-stretch gap-1.5 p-1.5 sm:p-2">
                  <input
                    type="checkbox"
                    className="mt-2 rounded border-slate-600"
                    checked={selectedContacts.has(c.phoneNumber)}
                    onChange={() => toggleSelectContact(c.phoneNumber)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-md p-1.5 text-left transition hover:bg-slate-900/80 sm:flex-row sm:items-center sm:justify-between"
                    onClick={() =>
                      setExpandedContact(expandedContact === c.phoneNumber ? null : c.phoneNumber)
                    }
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-100">{c.contactName || 'Unknown'}</div>
                      <div className="font-mono text-[11px] text-slate-500">{formatPhoneNumber(c.phoneNumber)}</div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Badge>{c.callCount} calls</Badge>
                      <Badge variant="incoming">{c.incoming} in</Badge>
                      <Badge variant="outgoing">{c.outgoing} out</Badge>
                      <Badge variant="missed">{c.missed} missed</Badge>
                      {c.deletedCount > 0 && <Badge variant="danger">{c.deletedCount} deleted</Badge>}
                      {!c.isActive && c.callCount > 0 && (
                        <Badge variant="muted">Inactive (all deleted)</Badge>
                      )}
                      {c.isActive && c.activeCount > 0 && (
                        <Badge variant="success">{c.activeCount} active</Badge>
                      )}
                      <Badge variant="muted">{formatDuration(c.totalDuration)}</Badge>
                    </div>
                  </button>
                  <RowActions
                    onEdit={() => setEditingContact(c)}
                    onDelete={() => handleDeleteContactCalls(c)}
                    disabled={deleting || saving}
                  />
                </div>
                {expandedContact === c.phoneNumber && (
                  <div className="border-t border-slate-800 px-3 py-2 text-xs text-slate-400">
                    <p>Last call: {formatCallDateTime(c.lastCallTime)}</p>
                    <p className="mt-1">Devices: {c.devices.join(', ') || '—'}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => {
                        setSearch(c.phoneNumber);
                        setTab('calls');
                      }}
                    >
                      View all calls →
                    </Button>
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
        </Panel>
        </div>
      )}

      {tab === 'devices' && showSkeleton && <DevicesLayoutSkeleton />}

      {tab === 'devices' && loadedTabs.has('devices') && (
        <div className={cn('relative transition-opacity duration-200', fetching && 'opacity-80')}>
          <LoadingOverlay active={fetching} className="rounded-none" />
          <SectionHeading
            icon={Smartphone}
            title="Devices & Debug"
            description="Select a device to inspect telemetry, permissions, and recent calls"
          />

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-stretch">
            {/* Device list */}
            <Panel
              className={cn(
                'flex max-h-none flex-col lg:sticky lg:top-18 lg:max-h-[calc(100vh-5.5rem)]',
                selectedDevice && 'hidden lg:flex'
              )}
            >
              <PanelHeader
                title={`Devices (${devices.length})`}
                hint="Select a device"
                actions={
                  selectedDevices.size > 0 ? (
                    <Button variant="danger" size="sm" disabled={deleting} onClick={requestDeleteSelectedDevices}>
                      Delete ({selectedDevices.size})
                    </Button>
                  ) : undefined
                }
              />
              <DevicesTable
                variant="sidebar"
                devices={devices}
                selectedDevices={selectedDevices}
                selectedDeviceId={selectedDevice?.device.device_id}
                deleting={deleting}
                saving={saving}
                onToggleSelect={toggleSelectDevice}
                onToggleSelectAll={toggleSelectAllDevices}
                onSelect={loadDeviceDetail}
                onEdit={setEditingDevice}
                onDelete={handleDeleteDevice}
              />
            </Panel>

            {/* Debug panel */}
            <Panel
              className={cn(
                'relative flex max-h-[calc(100vh-5.5rem)] min-h-[320px] flex-col overflow-hidden',
                !selectedDevice && 'hidden lg:flex'
              )}
            >
              {selectedDevice ? (
                <>
                  <div className="flex shrink-0 items-center gap-2 border-b border-slate-800 bg-slate-900/80 px-3 py-2.5 lg:px-4">
                    <button
                      type="button"
                      onClick={() => setSelectedDevice(null)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 lg:hidden"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
                      Back
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-100">
                        {selectedDevice.device.device_name || 'Unnamed device'}
                      </div>
                      <div className="truncate font-mono text-[10px] text-slate-500">
                        {selectedDevice.device.device_id}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={deviceLoading}
                        onClick={() => loadDeviceDetail(selectedDevice.device.device_id)}
                      >
                        {deviceLoading ? '…' : 'Reload'}
                      </Button>
                      <RowActions
                        compact
                        onEdit={() => {
                          const d = devices.find((x) => x.device_id === selectedDevice.device.device_id);
                          if (d) setEditingDevice(d);
                        }}
                        onDelete={() => {
                          const d = devices.find((x) => x.device_id === selectedDevice.device.device_id);
                          if (d) handleDeleteDevice(d);
                        }}
                        disabled={deleting || saving}
                      />
                    </div>
                  </div>
                  <LoadingOverlay active={deviceLoading} />
                  <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
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
                      onEditCall={setEditingCall}
                      onDeleteCall={requestDeleteCall}
                    />
                  </div>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800/80 text-slate-400">
                    <Smartphone className="h-7 w-7" strokeWidth={1.75} />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-200">Select a device</h3>
                  <p className="mt-1 max-w-xs text-xs text-slate-500">
                    Choose a device from the list to view permissions, network info, SQLite status, and recent calls.
                  </p>
                </div>
              )}
            </Panel>
          </div>
        </div>
      )}

      {tab === 'sync' && showSkeleton && <PanelSkeleton withToolbar />}

      {tab === 'sync' && loadedTabs.has('sync') && (
        <div className={cn('relative transition-opacity duration-200', fetching && 'opacity-80')}>
          <LoadingOverlay active={fetching} />
        <Panel>
          <PanelToolbar>
            <select className={selectClassName} value={deviceFilter} onChange={(e) => setDeviceFilter(e.target.value)}>
              <option value="">All devices</option>
              {devices.map((d) => (
                <option key={d.device_id} value={d.device_id}>
                  {d.device_name || d.device_id}
                </option>
              ))}
            </select>
          </PanelToolbar>
          <PanelHeader
            title={`${totalSync.toLocaleString()} sync batches`}
            actions={
              selectedSync.size > 0 ? (
                <Button variant="danger" size="sm" disabled={deleting} onClick={requestDeleteSelectedSync}>
                  Delete selected ({selectedSync.size})
                </Button>
              ) : undefined
            }
          />
          <SyncAuditTable
            entries={syncAudit}
            selected={selectedSync}
            deleting={deleting}
            onToggleSelect={toggleSelectSync}
            onToggleSelectAll={toggleSelectAllSync}
            onDelete={handleDeleteSyncAudit}
          />
          <Pagination
            page={syncPage}
            totalPages={Math.max(1, Math.ceil(totalSync / PAGE_SIZE))}
            hasMore={hasMoreSync}
            onPageChange={setSyncPage}
          />
        </Panel>
        </div>
      )}
    </DashboardLayout>

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
    </>
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
    <PanelToolbar>
      <input
        className={inputClassName}
        placeholder="Search phone or contact..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <select className={selectClassName} value={deviceFilter} onChange={(e) => onDeviceFilterChange(e.target.value)}>
        <option value="">All devices</option>
        {devices.map((d) => (
          <option key={d.device_id} value={d.device_id}>{d.device_name || d.device_id}</option>
        ))}
      </select>
      <select className={selectClassName} value={callTypeFilter} onChange={(e) => onCallTypeFilterChange(e.target.value)}>
        <option value="">All types</option>
        {['INCOMING', 'OUTGOING', 'MISSED', 'REJECTED', 'BLOCKED', 'VOICEMAIL'].map((t) => (
          <option key={t} value={t}>{callTypeLabel(t)}</option>
        ))}
      </select>
      <select
        className={selectClassName}
        value={statusFilter}
        onChange={(e) => onStatusFilterChange(e.target.value as 'all' | 'active' | 'deleted')}
      >
        <option value="all">All status</option>
        <option value="active">Active only</option>
        <option value="deleted">Deleted from phone</option>
      </select>
    </PanelToolbar>
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
      <div className="py-8 text-center text-xs text-slate-500">
        <p className="text-slate-400">No call logs found.</p>
      </div>
    );
  }

  const showCheckboxes = !compact || selectable;
  const pageSelectedCount = calls.filter((c) => selected.has(c.serverId)).length;
  const showDevice = !compact;
  const showSim = !compact;
  const showSynced = !compact;

  return (
    <>
      <div className={cn(tableWrapClass, 'hidden md:block')}>
        <table className={tableClass}>
          <thead className={theadClass}>
            <tr>
              {showCheckboxes && (
                <th className={cn(thClass, 'w-8')}>
                  <input
                    type="checkbox"
                    className="rounded border-slate-600"
                    checked={calls.length > 0 && pageSelectedCount === calls.length}
                    onChange={onToggleSelectAll}
                  />
                </th>
              )}
              <th className={thClass}>Contact Name</th>
              <th className={thClass}>Phone Number</th>
              <th className={thClass}>Call Type</th>
              <th className={thClass}>Duration</th>
              {showSim && <th className={thClass}>SIM Slot</th>}
              {showDevice && <th className={thClass}>Device</th>}
              <th className={thClass}>Call Time</th>
              {showSynced && <th className={thClass}>Synced At</th>}
              <th className={thClass}>Status</th>
              <th className={cn(thClass, 'text-right')}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {calls.map((c) => (
              <tr key={c.serverId} className={cn(trHoverClass, c.isDeleted && 'opacity-75')}>
                {showCheckboxes && (
                  <td className={tdClass}>
                    <input
                      type="checkbox"
                      className="rounded border-slate-600"
                      checked={selected.has(c.serverId)}
                      onChange={() => onToggleSelect(c.serverId)}
                    />
                  </td>
                )}
                <td className={cn(tdClass, 'max-w-[140px]')}>
                  <div className={cn('truncate font-medium text-slate-100', c.isDeleted && 'line-through text-slate-400')}>
                    {c.contactName || 'Unknown'}
                  </div>
                </td>
                <td className={cn(tdClass, 'font-mono text-[11px] text-slate-400')}>
                  {formatPhoneNumber(c.phoneNumber)}
                </td>
                <td className={tdClass}>
                  <Badge variant={callTypeToBadgeVariant(c.callType)}>{callTypeLabel(c.callType)}</Badge>
                </td>
                <td className={tdClass}>{formatDuration(c.duration)}</td>
                {showSim && <td className={tdClass}>{formatSimSlot(c.simSlot)}</td>}
                {showDevice && (
                  <td className={cn(tdClass, 'max-w-[120px]')}>
                    <div className="truncate text-slate-200">{c.deviceName || 'Device'}</div>
                    <div className="truncate font-mono text-[10px] text-slate-500">{c.deviceId}</div>
                  </td>
                )}
                <td className={cn(tdClass, 'text-[11px]')}>{formatCallDateTime(c.callTime)}</td>
                {showSynced && (
                  <td className={cn(tdClass, 'text-[11px] text-slate-400')}>{formatCallDateTime(c.syncedAt)}</td>
                )}
                <td className={tdClass}>
                  <Badge variant={c.isDeleted ? 'danger' : 'success'}>{c.isDeleted ? 'Deleted' : 'Active'}</Badge>
                </td>
                <td className={cn(tdClass, 'text-right')}>
                  <RowActions onEdit={() => onEditOne(c)} onDelete={() => onDeleteOne(c)} disabled={deleting} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 p-2 md:hidden">
        {calls.map((c) => (
          <div
            key={c.serverId}
            className={cn(
              'rounded-lg border border-slate-800/80 bg-slate-950/50 p-2.5',
              c.isDeleted && 'opacity-75'
            )}
          >
            <div className="flex items-start gap-2">
              {showCheckboxes && (
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-slate-600"
                  checked={selected.has(c.serverId)}
                  onChange={() => onToggleSelect(c.serverId)}
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className={cn('truncate text-sm font-medium text-slate-100', c.isDeleted && 'line-through text-slate-400')}>
                      {c.contactName || 'Unknown'}
                    </div>
                    <div className="truncate font-mono text-[11px] text-slate-500">{formatPhoneNumber(c.phoneNumber)}</div>
                  </div>
                  <Badge variant={c.isDeleted ? 'danger' : 'success'}>{c.isDeleted ? 'Deleted' : 'Active'}</Badge>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                  <div>
                    <span className="text-slate-500">Type </span>
                    <Badge variant={callTypeToBadgeVariant(c.callType)}>{callTypeLabel(c.callType)}</Badge>
                  </div>
                  <div><span className="text-slate-500">Duration </span><span className="text-slate-300">{formatDuration(c.duration)}</span></div>
                  {showSim && (
                    <div><span className="text-slate-500">SIM </span><span className="text-slate-300">{formatSimSlot(c.simSlot)}</span></div>
                  )}
                  {showDevice && (
                    <div className="col-span-2 truncate">
                      <span className="text-slate-500">Device </span>
                      <span className="text-slate-300">{c.deviceName || c.deviceId}</span>
                    </div>
                  )}
                  <div className="col-span-2"><span className="text-slate-500">Call </span><span className="text-slate-300">{formatCallDateTime(c.callTime)}</span></div>
                  {showSynced && (
                    <div className="col-span-2"><span className="text-slate-500">Synced </span><span className="text-slate-400">{formatCallDateTime(c.syncedAt)}</span></div>
                  )}
                </div>
                <div className="mt-2 flex justify-end border-t border-slate-800/80 pt-2">
                  <RowActions compact onEdit={() => onEditOne(c)} onDelete={() => onDeleteOne(c)} disabled={deleting} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function DevicesTable({
  devices,
  selectedDevices,
  selectedDeviceId,
  deleting,
  saving,
  variant = 'full',
  onToggleSelect,
  onToggleSelectAll,
  onSelect,
  onEdit,
  onDelete,
}: {
  devices: DeviceRecord[];
  selectedDevices: Set<string>;
  selectedDeviceId?: string;
  deleting: boolean;
  saving: boolean;
  variant?: 'full' | 'sidebar';
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onSelect: (id: string) => void;
  onEdit: (d: DeviceRecord) => void;
  onDelete: (d: DeviceRecord) => void;
}) {
  if (devices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
        <p className="text-sm font-medium text-slate-400">No devices registered yet</p>
        <p className="mt-1 text-xs text-slate-500">Devices appear here after the mobile app syncs.</p>
      </div>
    );
  }

  if (variant === 'sidebar') {
    return (
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-2">
        <label className="mb-2 flex items-center gap-2 px-1 text-[11px] text-slate-500">
          <input
            type="checkbox"
            className="rounded border-slate-600"
            checked={devices.length > 0 && selectedDevices.size === devices.length}
            onChange={onToggleSelectAll}
          />
          Select all
        </label>
        <div className="space-y-1.5">
          {devices.map((d) => (
            <div
              key={d.device_id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(d.device_id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(d.device_id);
                }
              }}
              className={cn(
                'w-full cursor-pointer rounded-lg border border-slate-800/80 bg-slate-950/50 p-2.5 text-left transition hover:border-slate-700',
                selectedDeviceId === d.device_id && 'border-indigo-500/50 bg-indigo-500/15 ring-1 ring-indigo-500/30'
              )}
            >
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-slate-600"
                  checked={selectedDevices.has(d.device_id)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => onToggleSelect(d.device_id)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-100">{d.device_name || 'Unnamed'}</div>
                      <div className="mt-0.5 break-all font-mono text-[9px] leading-tight text-slate-500">{d.device_id}</div>
                    </div>
                    <Badge variant={d.is_active ? 'success' : 'muted'} className="shrink-0 text-[10px]">
                      {d.is_active ? 'Active' : 'Off'}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-slate-400">
                    <span>{d.call_count} calls</span>
                    <span>·</span>
                    <span>{d.deleted_count} del</span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-slate-500">
                    {d.last_seen_at ? formatCallDateTime(d.last_seen_at) : 'Never seen'}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
      <div className={cn(tableWrapClass, 'hidden md:block')}>
        <table className={tableClass}>
          <thead className={theadClass}>
            <tr>
              <th className={cn(thClass, 'w-8')}>
                <input
                  type="checkbox"
                  className="rounded border-slate-600"
                  checked={devices.length > 0 && selectedDevices.size === devices.length}
                  onChange={onToggleSelectAll}
                />
              </th>
              <th className={thClass}>Device Name</th>
              <th className={thClass}>Total Calls</th>
              <th className={thClass}>Deleted Calls</th>
              <th className={thClass}>Last Seen</th>
              <th className={thClass}>Status</th>
              <th className={cn(thClass, 'text-right')}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr
                key={d.device_id}
                onClick={() => onSelect(d.device_id)}
                className={cn(
                  'cursor-pointer',
                  trHoverClass,
                  selectedDeviceId === d.device_id && 'bg-indigo-500/15 ring-1 ring-inset ring-indigo-500/30'
                )}
              >
                <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="rounded border-slate-600"
                    checked={selectedDevices.has(d.device_id)}
                    onChange={() => onToggleSelect(d.device_id)}
                  />
                </td>
                <td className={cn(tdClass, 'max-w-[160px]')}>
                  <div className="truncate font-medium text-slate-100">{d.device_name || 'Unnamed'}</div>
                  <div className="truncate font-mono text-[10px] text-slate-500">{d.device_id}</div>
                </td>
                <td className={tdClass}>{d.call_count}</td>
                <td className={tdClass}>{d.deleted_count}</td>
                <td className={cn(tdClass, 'text-[11px] text-slate-400')}>
                  {d.last_seen_at ? formatCallDateTime(d.last_seen_at) : 'Never'}
                </td>
                <td className={tdClass}>
                  <Badge variant={d.is_active ? 'success' : 'muted'}>{d.is_active ? 'Active' : 'Inactive'}</Badge>
                </td>
                <td className={cn(tdClass, 'text-right')} onClick={(e) => e.stopPropagation()}>
                  <RowActions onEdit={() => onEdit(d)} onDelete={() => onDelete(d)} disabled={deleting || saving} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-1.5 p-2 md:hidden">
        {devices.map((d) => (
          <button
            key={d.device_id}
            type="button"
            onClick={() => onSelect(d.device_id)}
            className={cn(
              'w-full rounded-lg border border-slate-800/80 bg-slate-950/50 p-2.5 text-left transition',
              selectedDeviceId === d.device_id && 'border-indigo-500/50 bg-indigo-500/15 ring-1 ring-indigo-500/30'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-100">{d.device_name || 'Unnamed'}</div>
                <div className="truncate font-mono text-[10px] text-slate-500">{d.device_id}</div>
              </div>
              <Badge variant={d.is_active ? 'success' : 'muted'}>{d.is_active ? 'Active' : 'Inactive'}</Badge>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] text-slate-400">
              <span>{d.call_count} calls</span>
              <span>{d.deleted_count} deleted</span>
              <span>{d.last_seen_at ? formatCallDateTime(d.last_seen_at) : 'Never'}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function SyncAuditTable({
  entries,
  selected,
  deleting,
  onToggleSelect,
  onToggleSelectAll,
  onDelete,
}: {
  entries: SyncAuditEntry[];
  selected: Set<number>;
  deleting: boolean;
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: () => void;
  onDelete: (e: SyncAuditEntry) => void;
}) {
  return (
    <div className={tableWrapClass}>
      <table className={cn(tableClass, 'min-w-[680px]')}>
        <thead className={theadClass}>
          <tr>
            <th className={cn(thClass, 'w-8')}>
              <input
                type="checkbox"
                className="rounded border-slate-600"
                checked={entries.length > 0 && selected.size === entries.length}
                onChange={onToggleSelectAll}
              />
            </th>
            <th className={thClass}>Timestamp</th>
            <th className={thClass}>Device Name</th>
            <th className={thClass}>Batch Size</th>
            <th className={thClass}>Synced Count</th>
            <th className={thClass}>Failed Count</th>
            <th className={thClass}>IP Address</th>
            <th className={cn(thClass, 'text-right')}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className={trHoverClass}>
              <td className={tdClass}>
                <input
                  type="checkbox"
                  className="rounded border-slate-600"
                  checked={selected.has(e.id)}
                  onChange={() => onToggleSelect(e.id)}
                />
              </td>
              <td className={cn(tdClass, 'text-[11px]')}>{formatCallDateTime(e.createdAt)}</td>
              <td className={cn(tdClass, 'max-w-[120px] truncate text-slate-200')}>
                {e.deviceName || e.deviceId.slice(0, 12)}
              </td>
              <td className={tdClass}>{e.batchSize}</td>
              <td className={tdClass}><Badge variant="success">{e.syncedCount}</Badge></td>
              <td className={tdClass}>
                {e.failedCount > 0 ? <Badge variant="danger">{e.failedCount}</Badge> : '0'}
              </td>
              <td className={cn(tdClass, 'font-mono text-[10px] text-slate-400')}>{e.ipAddress || '—'}</td>
              <td className={cn(tdClass, 'text-right')}>
                <RowActions onDelete={() => onDelete(e)} disabled={deleting} />
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
    <div className="flex flex-wrap items-center justify-center gap-3 border-t border-slate-800 px-4 py-3 text-sm text-slate-400">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))}>
        <ChevronLeft className="h-4 w-4" strokeWidth={2} />
        Previous
      </Button>
      <span className="text-sm">
        Page <strong className="text-slate-200">{page}</strong> of {totalPages}
      </span>
      <Button variant="outline" size="sm" disabled={!hasMore} onClick={() => onPageChange(page + 1)}>
        Next
        <ChevronRight className="h-4 w-4" strokeWidth={2} />
      </Button>
    </div>
  );
}
