import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CallLogPluginService } from '../core/services/call-log-plugin.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit {
  bridgeStatus = 'Initializing...';
  deviceId = '';
  permissions: Record<string, boolean> = {};
  isLoading = false;
  appReady = false;

  constructor(
    private callLogPlugin: CallLogPluginService,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      this.appReady = true;
      this.bridgeStatus = 'App initialized successfully';
      await this.loadDeviceInfo();
    } catch (error) {
      this.bridgeStatus = `Init FAILED: ${error}`;
    }
  }

  async testBridge(): Promise<void> {
    this.isLoading = true;
    try {
      const echo = await this.callLogPlugin.testBridge('Hello from Ionic!');
      this.bridgeStatus = `Bridge OK: "${echo}"`;
    } catch (error) {
      this.bridgeStatus = `Bridge FAILED: ${error}`;
    } finally {
      this.isLoading = false;
    }
  }

  async loadDeviceInfo(): Promise<void> {
    try {
      this.deviceId = await this.callLogPlugin.getDeviceId();
      const perms = await this.callLogPlugin.checkPermissions();
      this.permissions = perms as unknown as Record<string, boolean>;
    } catch (error) {
      console.error('Failed to load device info:', error);
    }
  }

  async requestPermissions(): Promise<void> {
    const perms = await this.callLogPlugin.requestPermissions();
    this.permissions = perms as unknown as Record<string, boolean>;
  }

  goToCallLog(): void {
    this.router.navigate(['/call-log']);
  }
}
