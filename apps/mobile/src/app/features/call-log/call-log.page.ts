import { Component, OnDestroy, OnInit } from '@angular/core';
import { ViewWillEnter } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { PluginStatus } from 'call-log-sync';

import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { CallLogPluginService } from '../../core/services/call-log-plugin.service';
import { NetworkMonitorService } from '../../core/services/network-monitor.service';
import { SyncService } from '../../core/services/sync.service';
import { TelemetryService } from '../../core/services/telemetry.service';
import {
  callTypeColor,
  callTypeIcon,
  callTypeLabel,
  formatCallDateGroup,
  formatCallDateTime,
  formatDuration,
} from '../../core/utils/format.util';
import { CallLogRecord } from 'src/app/core/models/call-log.model';

interface CallGroup {
  label: string;
  calls: CallLogRecord[];
}

@Component({
  selector: 'app-call-log',
  templateUrl: './call-log.page.html',
  styleUrls: ['./call-log.page.scss'],
  standalone: false,
})
export class CallLogPage implements OnInit, OnDestroy, ViewWillEnter {
  calls: CallLogRecord[] = [];
  groupedCalls: CallGroup[] = [];
  pendingCount = 0;
  syncedCount = 0;
  totalCount = 0;
  isSyncing = false;
  isLoading = false;
  deviceId = '';
  observerActive = false;
  isOnline = true;
  lastError: string | null = null;
  lastSyncAt = 0;
  hasCallLogPermission = false;
  showDebug = false;
  debugInfo: {
    ready: boolean;
    native: boolean;
    total: number;
    pending: number;
    synced: number;
    failed: number;
  } | null = null;
  apiUrl = environment.apiUrl;
  hasAuth = false;
  pluginStatus: PluginStatus | null = null;
  hasContactsPermission = false;
  networkLabel = '—';

  readonly formatCallDateTime = formatCallDateTime;
  readonly formatDuration = formatDuration;
  readonly callTypeLabel = callTypeLabel;
  readonly callTypeIcon = callTypeIcon;
  readonly callTypeColor = callTypeColor;

  private subscriptions = new Subscription();

  constructor(
    private plugin: CallLogPluginService,
    private sync: SyncService,
    private auth: AuthService,
    private network: NetworkMonitorService,
    private telemetry: TelemetryService
  ) {}

  async ngOnInit(): Promise<void> {
    this.deviceId = await this.plugin.getDeviceId();

    this.subscriptions.add(
      this.sync.status$.subscribe((status) => {
        const countsChanged =
          this.pendingCount !== status.pending ||
          this.syncedCount !== status.synced ||
          this.totalCount !== status.total;

        this.pendingCount = status.pending;
        this.syncedCount = status.synced;
        this.totalCount = status.total;
        this.isSyncing = status.syncing;
        this.lastError = status.lastError;
        this.lastSyncAt = status.lastSyncAt;

        if (!status.syncing && countsChanged) {
          this.loadCalls().catch(console.error);
        }
      })
    );

    this.subscriptions.add(
      this.network.connected.subscribe((connected) => {
        this.isOnline = connected;
      })
    );

    this.subscriptions.add(
      this.network.details.subscribe((details) => {
        this.networkLabel = this.formatNetworkLabel(details);
      })
    );

    this.observerActive = this.plugin.isObserverActive();
    const perms = await this.plugin.checkPermissions();
    this.hasCallLogPermission = perms.readCallLog;
    this.hasContactsPermission = perms.readContacts;
    this.hasAuth = !!(this.auth.getAccessToken() && this.auth.getApiKey());
    await this.loadCalls();
    await this.refreshDebug();
    await this.telemetry.uploadIfDue(true);
  }

  ionViewWillEnter(): void {
    this.refreshDebug().catch(console.error);
    this.telemetry.uploadIfDue(true).catch(console.error);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  async loadCalls(): Promise<void> {
    this.isLoading = true;
    try {
      const result = await this.sync.getLocalCalls(200, 0);
      this.calls = result.records;
      this.groupedCalls = this.groupCallsByDate(result.records);
    } finally {
      this.isLoading = false;
    }
  }

  async handleRefresh(event: CustomEvent): Promise<void> {
    await this.plugin.importDeviceCalls(500, true);
    await this.sync.syncPending();
    await this.loadCalls();
    (event.target as HTMLIonRefresherElement).complete();
  }

  async requestPermissions(): Promise<void> {
    const perms = await this.plugin.requestPermissions();
    this.hasCallLogPermission = perms.readCallLog;
    this.hasContactsPermission = perms.readContacts;
    if (perms.readCallLog) {
      this.observerActive = await this.plugin.startObserver(false);
      await this.plugin.importDeviceCalls(500, true);
      await this.sync.syncPending();
      await this.refreshDebug();
    }
  }

  async manualSync(): Promise<void> {
    await this.plugin.importDeviceCalls(500, true);
    const result = await this.sync.syncPending();
    if (result.errors.length > 0) {
      this.lastError = result.errors.join('; ');
    }
    await this.loadCalls();
    await this.refreshDebug();
  }

  toggleDebug(): void {
    this.showDebug = !this.showDebug;
    if (this.showDebug) {
      this.refreshDebug().catch(console.error);
      this.telemetry.uploadIfDue(true).catch(console.error);
    }
  }

  async refreshDebug(): Promise<void> {
    this.debugInfo = await this.sync.getDebugInfo();
    this.hasAuth = !!(this.auth.getAccessToken() && this.auth.getApiKey());
    try {
      this.pluginStatus = await this.plugin.getPluginStatus();
      this.observerActive = this.pluginStatus.observerActive;
      this.hasCallLogPermission = this.pluginStatus.permissions.readCallLog;
      this.hasContactsPermission = this.pluginStatus.permissions.readContacts;
      this.deviceId = this.pluginStatus.deviceId;
    } catch (error) {
      console.error('[CallLogPage] getPluginStatus failed:', error);
    }
    await this.telemetry.uploadIfDue(true);
    await this.network.refresh();
  }

  private formatNetworkLabel(details: {
    connected: boolean;
    connectionType: string;
    networkName: string;
  }): string {
    if (!details.connected) return 'Offline';
    const type =
      details.connectionType === 'wifi'
        ? 'Wi‑Fi'
        : details.connectionType === 'cellular'
          ? 'Mobile data'
          : details.connectionType;
    return details.networkName ? `${type}: ${details.networkName}` : type;
  }

  get lastNativeSyncLabel(): string {
    const ts = this.pluginStatus?.lastNativeSyncAt ?? 0;
    if (!ts) return 'Never';
    return formatCallDateTime(ts);
  }

  async reRegisterDevice(): Promise<void> {
    try {
      await this.auth.refreshDeviceRegistration();
      this.hasAuth = true;
      await this.sync.syncPending();
      await this.refreshDebug();
      this.lastError = null;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
    }
  }

  get syncStatusText(): string {
    if (this.isSyncing) return 'Syncing call logs...';
    if (!this.isOnline) return 'Offline — storing locally until connected';
    if (this.pendingCount > 0) return `${this.pendingCount} call(s) waiting to upload`;
    if (this.lastSyncAt > 0) return 'All call logs synced';
    return 'Ready to sync';
  }

  get lastSyncLabel(): string {
    if (!this.lastSyncAt) return 'Never';
    return formatCallDateTime(this.lastSyncAt);
  }

  statusColor(status: string): string {
    switch (status) {
      case 'SYNCED':
        return 'success';
      case 'PENDING':
        return 'warning';
      case 'FAILED':
        return 'danger';
      case 'SYNCING':
        return 'tertiary';
      default:
        return 'medium';
    }
  }

  private groupCallsByDate(records: CallLogRecord[]): CallGroup[] {
    const groups = new Map<string, CallLogRecord[]>();

    for (const call of records) {
      const label = formatCallDateGroup(call.callTime);
      const existing = groups.get(label) ?? [];
      existing.push(call);
      groups.set(label, existing);
    }

    return Array.from(groups.entries()).map(([label, calls]) => ({ label, calls }));
  }
}
