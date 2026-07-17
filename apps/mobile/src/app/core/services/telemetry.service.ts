import { Injectable } from '@angular/core';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { CallLogSync } from 'call-log-sync';

import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { NetworkMonitorService } from './network-monitor.service';
import { SqliteService } from './sqlite.service';

/**
 * Uploads device permissions, plugin status, and SQLite debug info to the server
 * so the admin dashboard can show live device health.
 */
@Injectable({
  providedIn: 'root',
})
export class TelemetryService {
  private lastUploadAt = 0;
  private static readonly MIN_INTERVAL_MS = 5_000;

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private sqlite: SqliteService,
    private network: NetworkMonitorService
  ) {}

  async uploadIfDue(force = false): Promise<void> {
    const now = Date.now();
    if (!force && now - this.lastUploadAt < TelemetryService.MIN_INTERVAL_MS) {
      return;
    }

    const token = this.auth.getAccessToken();
    const apiKey = this.auth.getApiKey();
    const deviceId = this.auth.getDeviceId();
    if (!token || !apiKey || !deviceId) {
      console.warn('[Telemetry] skipped — missing auth or deviceId');
      return;
    }
    if (!force && !this.network.isConnected()) {
      return;
    }

    try {
      const [permissions, pluginStatus, sqliteDebug, appInfo] = await Promise.all([
        CallLogSync.checkPermissions(),
        CallLogSync.getPluginStatus(),
        this.sqlite.getDebugInfo(),
        App.getInfo().catch(() => ({ version: 'unknown', build: '' })),
      ]);

      await this.api.reportDeviceTelemetry(token, apiKey, {
        deviceId,
        permissions,
        pluginStatus,
        sqliteDebug,
        syncStatus: {
          pending: sqliteDebug.pending,
          synced: sqliteDebug.synced,
          failed: sqliteDebug.failed,
          total: sqliteDebug.total,
        },
        authStatus: 'Token + API key OK',
        apiUrl: this.api.getApiUrl(),
        appVersion: appInfo.version,
        osVersion: Capacitor.getPlatform() === 'android' ? `Android` : Capacitor.getPlatform(),
        networkConnected: this.network.isConnected(),
        platform: Capacitor.getPlatform(),
        reportedAt: new Date().toISOString(),
      });

      this.lastUploadAt = now;
      console.info('[Telemetry] uploaded to server');
    } catch (err) {
      console.warn('[Telemetry] upload failed', err);
      throw err;
    }
  }
}
