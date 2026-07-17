import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { CallLogSync } from 'call-log-sync';

import { environment } from '../../../environments/environment';
import { ApiService } from './api.service';
import { AuthTokens, DeviceRegistration } from '../models/call-log.model';

const KEYS = {
  ACCESS_TOKEN: 'auth_access_token',
  REFRESH_TOKEN: 'auth_refresh_token',
  API_KEY: 'device_api_key',
  DEVICE_ID: 'device_id',
  DEVICE_REGISTERED: 'device_registered',
} as const;

/**
 * AuthService — JWT + device registration management.
 * Stores tokens securely in Capacitor Preferences.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private tokens: AuthTokens | null = null;
  private apiKey: string | null = null;
  private deviceId: string | null = null;

  constructor(private api: ApiService) {}

  async initialize(): Promise<void> {
    const [token, refresh, apiKey, deviceId] = await Promise.all([
      Preferences.get({ key: KEYS.ACCESS_TOKEN }),
      Preferences.get({ key: KEYS.REFRESH_TOKEN }),
      Preferences.get({ key: KEYS.API_KEY }),
      Preferences.get({ key: KEYS.DEVICE_ID }),
    ]);

    if (token.value) {
      this.tokens = {
        accessToken: token.value,
        refreshToken: refresh.value ?? undefined,
      };
    }
    this.apiKey = apiKey.value;
    this.deviceId = deviceId.value;

    if (await this.isDeviceRegistered()) {
      await this.refreshNativeBackgroundSync();
    }
  }

  async ensureDeviceRegistered(
    deviceId: string,
    deviceName = 'Android Device'
  ): Promise<void> {
    this.deviceId = deviceId;
    await this.registerDevice(deviceId, deviceName);
  }

  async refreshDeviceRegistration(
    deviceName = 'Android Device'
  ): Promise<void> {
    const deviceId =
      this.deviceId ?? (await Preferences.get({ key: KEYS.DEVICE_ID })).value;
    if (!deviceId) {
      throw new Error('No device ID — cannot re-register');
    }
    await this.registerDevice(deviceId, deviceName);
  }

  async registerDevice(
    deviceId: string,
    deviceName: string
  ): Promise<DeviceRegistration> {
    const result = await this.api.registerDevice(deviceId, deviceName);

    this.tokens = { accessToken: result.token };
    this.apiKey = result.apiKey;
    this.deviceId = deviceId;

    await Promise.all([
      Preferences.set({ key: KEYS.ACCESS_TOKEN, value: result.token }),
      Preferences.set({ key: KEYS.API_KEY, value: result.apiKey }),
      Preferences.set({ key: KEYS.DEVICE_ID, value: deviceId }),
      Preferences.set({ key: KEYS.DEVICE_REGISTERED, value: 'true' }),
    ]);

    await this.configureNativeBackgroundSync(deviceId, result.token, result.apiKey);

    return { deviceId, deviceName, apiKey: result.apiKey };
  }

  async login(email: string, password: string): Promise<void> {
    const result = await this.api.login(email, password);
    this.tokens = {
      accessToken: result.token,
      refreshToken: result.refreshToken,
    };

    await Promise.all([
      Preferences.set({ key: KEYS.ACCESS_TOKEN, value: result.token }),
      Preferences.set({ key: KEYS.REFRESH_TOKEN, value: result.refreshToken }),
    ]);
  }

  getAccessToken(): string | null {
    return this.tokens?.accessToken ?? null;
  }

  getApiKey(): string | null {
    return this.apiKey;
  }

  getDeviceId(): string | null {
    return this.deviceId;
  }

  isAuthenticated(): boolean {
    return !!this.tokens?.accessToken;
  }

  async isDeviceRegistered(): Promise<boolean> {
    const result = await Preferences.get({ key: KEYS.DEVICE_REGISTERED });
    return result.value === 'true';
  }

  async logout(): Promise<void> {
    this.tokens = null;
    this.apiKey = null;
    this.deviceId = null;
    await Preferences.clear();
  }

  private async refreshNativeBackgroundSync(): Promise<void> {
    const token = this.getAccessToken();
    const apiKey = this.getApiKey();
    const deviceId = this.deviceId ?? (await Preferences.get({ key: KEYS.DEVICE_ID })).value;

    if (!token || !apiKey || !deviceId) return;

    this.deviceId = deviceId;
    await this.configureNativeBackgroundSync(deviceId, token, apiKey);
  }

  private async configureNativeBackgroundSync(
    deviceId: string,
    token: string,
    apiKey: string
  ): Promise<void> {
    await CallLogSync.configureBackgroundSync({
      apiUrl: environment.apiUrl,
      token,
      apiKey,
      deviceId,
    });
  }
}
