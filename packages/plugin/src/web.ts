import { WebPlugin } from '@capacitor/core';

import type {
  CallLogEntry,
  CallLogSyncPlugin,
  PermissionStatus,
  PluginStatus,
  ReadCallLogOptions,
  ReadCallLogResult,
  StartObserverOptions,
} from './definitions';

/**
 * Web (Browser) Stub Implementation
 * Used during `ionic serve` when no Android runtime is available.
 */
export class CallLogSyncWeb extends WebPlugin implements CallLogSyncPlugin {
  async echo(options: { value: string }): Promise<{ value: string }> {
    console.warn('[CallLogSync] Web stub — echo:', options.value);
    return { value: options.value };
  }

  async checkPermissions(): Promise<PermissionStatus> {
    return {
      readCallLog: false,
      readPhoneState: false,
      readContacts: false,
      postNotifications: false,
    };
  }

  async requestPermissions(): Promise<PermissionStatus> {
    console.warn('[CallLogSync] Permissions not available on web platform');
    return this.checkPermissions();
  }

  async readCallLog(_options?: ReadCallLogOptions): Promise<ReadCallLogResult> {
    console.warn('[CallLogSync] readCallLog not available on web platform');
    return { calls: [], total: 0, hasMore: false };
  }

  async startObserver(
    _options?: StartObserverOptions
  ): Promise<{ started: boolean }> {
    console.warn('[CallLogSync] Observer not available on web platform');
    return { started: false };
  }

  async stopObserver(): Promise<{ stopped: boolean }> {
    return { stopped: true };
  }

  async getDeviceId(): Promise<{ deviceId: string }> {
    return { deviceId: 'web-stub-device-id' };
  }

  async getPluginStatus(): Promise<PluginStatus> {
    const permissions = await this.checkPermissions();
    return {
      observerActive: false,
      contactsObserverActive: false,
      backgroundSyncConfigured: false,
      backgroundSyncPending: false,
      trackedCallsCount: 0,
      lastNativeSyncAt: 0,
      deviceId: 'web-stub-device-id',
      permissions,
    };
  }

  async getNetworkInfo() {
    return {
      connected: typeof navigator !== 'undefined' ? navigator.onLine : false,
      connectionType: 'unknown' as const,
      networkName: 'Web',
    };
  }

  async getCachedDeletionsFromPhone(): Promise<{ calls: CallLogEntry[]; count: number }> {
    return { calls: [], count: 0 };
  }

  async clearCachedDeletions(_options: { androidIds: number[] }): Promise<{ cleared: number }> {
    return { cleared: 0 };
  }

  async scheduleBackgroundSync(): Promise<{ scheduled: boolean }> {
    return { scheduled: false };
  }

  async cancelBackgroundSync(): Promise<{ cancelled: boolean }> {
    return { cancelled: true };
  }

  async isBackgroundSyncPending(): Promise<{ pending: boolean }> {
    return { pending: false };
  }

  async clearBackgroundSyncPending(): Promise<{ cleared: boolean }> {
    return { cleared: true };
  }

  async configureBackgroundSync(_options: {
    apiUrl: string;
    token: string;
    apiKey: string;
    deviceId: string;
  }): Promise<{ configured: boolean }> {
    return { configured: false };
  }
}
