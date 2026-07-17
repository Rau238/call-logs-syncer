import { Injectable, OnDestroy } from '@angular/core';
import { App } from '@capacitor/app';
import {
  CallLogEntry,
  CallLogSync,
  PermissionStatus,
  PluginStatus,
  ReadCallLogOptions,
  ReadCallLogResult,
} from 'call-log-sync';
import type { PluginListenerHandle } from '@capacitor/core';

import { SyncService } from './sync.service';
import { TelemetryService } from './telemetry.service';
import { getSyncWindowStartMs } from '../constants/sync.config';

/**
 * CallLogPluginService — Wraps the Capacitor plugin for Angular.
 * Registers real-time listeners and routes events to SyncService.
 */
@Injectable({
  providedIn: 'root',
})
export class CallLogPluginService implements OnDestroy {
  private listeners: PluginListenerHandle[] = [];
  private observerStarted = false;
  private importInProgress: Promise<number> | null = null;
  private lastImportAt = 0;
  private static readonly IMPORT_COOLDOWN_MS = 10_000;

  constructor(
    private syncService: SyncService,
    private telemetry: TelemetryService
  ) {}

  async initialize(): Promise<void> {
    await this.registerEventListeners();
    await this.registerAppLifecycle();
  }

  ngOnDestroy(): void {
    this.removeAllListeners();
  }

  async testBridge(message: string): Promise<string> {
    const result = await CallLogSync.echo({ value: message });
    return result.value;
  }

  async getDeviceId(): Promise<string> {
    const result = await CallLogSync.getDeviceId();
    return result.deviceId;
  }

  async checkPermissions(): Promise<PermissionStatus> {
    return CallLogSync.checkPermissions();
  }

  async requestPermissions(): Promise<PermissionStatus> {
    return CallLogSync.requestPermissions();
  }

  async readCallLog(options?: ReadCallLogOptions): Promise<ReadCallLogResult> {
    return CallLogSync.readCallLog(options);
  }

  async startObserver(includeExisting = false): Promise<boolean> {
    const result = await CallLogSync.startObserver({ includeExisting });
    this.observerStarted = result.started;
    return result.started;
  }

  async getPluginStatus(): Promise<PluginStatus> {
    const status = await CallLogSync.getPluginStatus();
    this.observerStarted = status.observerActive;
    return status;
  }

  isObserverActive(): boolean {
    return this.observerStarted;
  }

  /** Import device call log into SQLite and reconcile deletions/updates. */
  async importDeviceCalls(limit = 500, force = false): Promise<number> {
    if (this.importInProgress) {
      return this.importInProgress;
    }

    const now = Date.now();
    if (!force && now - this.lastImportAt < CallLogPluginService.IMPORT_COOLDOWN_MS) {
      return 0;
    }

    this.importInProgress = this.doImportDeviceCalls(limit).finally(() => {
      this.importInProgress = null;
      this.lastImportAt = Date.now();
    });

    return this.importInProgress;
  }

  private async doImportDeviceCalls(limit: number): Promise<number> {
    const perms = await this.checkPermissions();
    if (!perms.readCallLog) return 0;

    const since = getSyncWindowStartMs();
    const result = await this.readCallLog({ limit, offset: 0, since });
    return this.syncService.reconcileDeviceCalls(result.calls);
  }

  async stopObserver(): Promise<void> {
    await CallLogSync.stopObserver();
    this.observerStarted = false;
  }

  async scheduleBackgroundSync(): Promise<void> {
    await CallLogSync.scheduleBackgroundSync();
  }

  private async registerEventListeners(): Promise<void> {
    const newCallHandle = await CallLogSync.addListener(
      'newCall',
      async (call: CallLogEntry) => {
        await this.syncService.upsertCallFromNative(call);
      }
    );

    const updatedHandle = await CallLogSync.addListener(
      'callUpdated',
      async (call: CallLogEntry) => {
        await this.syncService.upsertCallFromNative(call);
      }
    );

    const deletedHandle = await CallLogSync.addListener(
      'callDeleted',
      async (data: { androidId: number; hash: string; call?: CallLogEntry }) => {
        await this.syncService.preserveCallRemovedFromDevice(
          data.androidId,
          data.call
        );
      }
    );

    const bgSyncHandle = await CallLogSync.addListener(
      'backgroundSync',
      async () => {
        await this.importDeviceCalls();
        await this.syncService.syncPending();
        await CallLogSync.clearBackgroundSyncPending();
      }
    );

    this.listeners = [newCallHandle, updatedHandle, deletedHandle, bgSyncHandle];
  }

  private async registerAppLifecycle(): Promise<void> {
    await App.addListener('appStateChange', async ({ isActive }) => {
      if (!isActive) return;

      await this.importDeviceCalls();
      await this.syncService.syncPending();
      await this.telemetry.uploadIfDue(true);
      const pending = await CallLogSync.isBackgroundSyncPending();
      if (pending.pending) {
        await CallLogSync.clearBackgroundSyncPending();
      }
    });
  }

  private async removeAllListeners(): Promise<void> {
    for (const handle of this.listeners) {
      await handle.remove();
    }
    this.listeners = [];
    await CallLogSync.removeAllListeners();
  }
}
