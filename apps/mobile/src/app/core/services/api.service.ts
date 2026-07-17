import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CallLogRecord } from '../models/call-log.model';

export interface SyncPayload {
  deviceId: string;
  calls: Array<{
    hash: string;
    androidId: number;
    phoneNumber: string;
    contactName: string;
    callType: string;
    duration: number;
    callTime: number;
    simSlot: number;
  }>;
  deletions: Array<{
    hash?: string;
    androidId: number;
  }>;
}

export interface SyncResponse {
  synced: Array<{ hash: string; serverId: string }>;
  duplicates: string[];
  failed: Array<{ hash: string; reason: string }>;
  deleted: Array<{ hash: string; androidId: number }>;
  deleteFailed: Array<{ androidId: number; reason: string }>;
}

export interface HistoryResponse {
  calls: Array<Record<string, unknown>>;
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * ApiService — HTTP client for Node.js backend.
 * Never called directly from UI — only from SyncService.
 */
@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private defaultHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    });
  }

  private headers(token: string, apiKey?: string): HttpHeaders {
    let h = this.defaultHeaders().set('Authorization', `Bearer ${token}`);
    if (apiKey) {
      h = h.set('X-API-Key', apiKey);
    }
    return h;
  }

  private formatHttpError(error: unknown): string {
    if (error && typeof error === 'object' && 'error' in error) {
      const body = (error as { error?: unknown; message?: string }).error;
      if (typeof body === 'object' && body !== null) {
        const err = body as { error?: string; message?: string; details?: string };
        return err.error || err.message || err.details || JSON.stringify(body);
      }
      if (typeof body === 'string') return body;
    }
    return error instanceof Error ? error.message : String(error);
  }

  async registerDevice(
    deviceId: string,
    deviceName: string
  ): Promise<{ apiKey: string; token: string }> {
    try {
      return await firstValueFrom(
        this.http.post<{ apiKey: string; token: string }>(
          `${this.baseUrl}/auth/register-device`,
          { deviceId, deviceName },
          { headers: this.defaultHeaders() }
        )
      );
    } catch (error) {
      throw new Error(`Register device failed: ${this.formatHttpError(error)}`);
    }
  }

  async login(
    email: string,
    password: string
  ): Promise<{ token: string; refreshToken: string }> {
    try {
      return await firstValueFrom(
        this.http.post<{ token: string; refreshToken: string }>(
          `${this.baseUrl}/auth/login`,
          { email, password },
          { headers: this.defaultHeaders() }
        )
      );
    } catch (error) {
      throw new Error(`Login failed: ${this.formatHttpError(error)}`);
    }
  }

  async syncCall(
    token: string,
    apiKey: string,
    record: CallLogRecord
  ): Promise<{ serverId: string }> {
    return firstValueFrom(
      this.http.post<{ serverId: string }>(
        `${this.baseUrl}/call-log/sync`,
        {
          deviceId: record.deviceId,
          hash: record.hash,
          androidId: record.androidId,
          phoneNumber: record.phoneNumber,
          contactName: record.contactName,
          callType: record.callType,
          duration: record.duration,
          callTime: record.callTime,
          simSlot: record.simSlot,
        },
        { headers: this.headers(token, apiKey) }
      )
    );
  }

  async batchSync(
    token: string,
    apiKey: string,
    payload: SyncPayload
  ): Promise<SyncResponse> {
    try {
      return await firstValueFrom(
        this.http.post<SyncResponse>(
          `${this.baseUrl}/call-log/batch-sync`,
          payload,
          { headers: this.headers(token, apiKey) }
        )
      );
    } catch (error) {
      throw new Error(`Batch sync failed: ${this.formatHttpError(error)}`);
    }
  }

  async getPending(
    token: string,
    deviceId: string,
    page = 1,
    pageSize = 50
  ): Promise<HistoryResponse> {
    const params = new HttpParams()
      .set('deviceId', deviceId)
      .set('page', page)
      .set('pageSize', pageSize);

    return firstValueFrom(
      this.http.get<HistoryResponse>(`${this.baseUrl}/call-log/pending`, {
        headers: this.headers(token),
        params,
      })
    );
  }

  async getHistory(
    token: string,
    deviceId: string,
    page = 1,
    pageSize = 50
  ): Promise<HistoryResponse> {
    const params = new HttpParams()
      .set('deviceId', deviceId)
      .set('page', page)
      .set('pageSize', pageSize);

    return firstValueFrom(
      this.http.get<HistoryResponse>(`${this.baseUrl}/call-log/history`, {
        headers: this.headers(token),
        params,
      })
    );
  }

  async reportDeviceTelemetry(
    token: string,
    apiKey: string,
    payload: Record<string, unknown>
  ): Promise<{ saved: boolean }> {
    return firstValueFrom(
      this.http.post<{ saved: boolean }>(
        `${this.baseUrl}/call-log/device-telemetry`,
        payload,
        { headers: this.headers(token, apiKey) }
      )
    );
  }
}
