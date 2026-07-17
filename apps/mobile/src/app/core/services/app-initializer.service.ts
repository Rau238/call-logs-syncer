import { Injectable } from '@angular/core';

import { AuthService } from './auth.service';
import { CallLogPluginService } from './call-log-plugin.service';
import { NetworkMonitorService } from './network-monitor.service';
import { SqliteService } from './sqlite.service';
import { SyncService } from './sync.service';

/**
 * AppInitializerService — Boots all core services in correct order.
 * Auto-registers device, imports call logs, starts background sync.
 */
@Injectable({
  providedIn: 'root',
})
export class AppInitializerService {
  private booted = false;

  constructor(
    private sqlite: SqliteService,
    private auth: AuthService,
    private network: NetworkMonitorService,
    private sync: SyncService,
    private plugin: CallLogPluginService
  ) {}

  async initialize(): Promise<void> {
    if (this.booted) return;

    await this.sqlite.initialize();
    await this.auth.initialize();
    await this.plugin.initialize();

    const deviceId = await this.plugin.getDeviceId();
    await this.auth.ensureDeviceRegistered(deviceId);

    await this.sync.prepareForSync();

    await this.ensurePermissionsAndMonitoring();
    await this.plugin.importDeviceCalls(500, true);

    await this.network.initialize(() => {
      this.plugin.importDeviceCalls(500, true).then(() => {
        this.sync.syncPending().catch(console.error);
      });
    });

    await this.plugin.scheduleBackgroundSync();

    if (this.network.isConnected()) {
      await this.sync.syncPending();
    }

    this.booted = true;
  }

  private async ensurePermissionsAndMonitoring(): Promise<void> {
    const perms = await this.plugin.checkPermissions();
    if (!perms.readCallLog || !perms.readContacts || !perms.readPhoneState) {
      await this.plugin.requestPermissions();
    }

    const updated = await this.plugin.checkPermissions();
    if (updated.readCallLog) {
      const started = await this.plugin.startObserver(false);
      console.info('[AppInit] Call log observer started:', started);
    }

    try {
      const status = await this.plugin.getPluginStatus();
      console.info('[AppInit] Plugin status:', JSON.stringify(status));
    } catch (error) {
      console.warn('[AppInit] Could not read plugin status:', error);
    }
  }
}
