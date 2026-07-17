import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { CallLogEntry, CallLogSync } from 'call-log-sync';

import {
  CallLogRecord,
  SyncBatchResult,
  toCallLogRecord,
} from '../models/call-log.model';
import { isWithinSyncWindow, getSyncWindowStartMs } from '../constants/sync.config';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { NetworkMonitorService } from './network-monitor.service';
import { SqliteService } from './sqlite.service';
import { TelemetryService } from './telemetry.service';

const MAX_RETRY = 5;
const BATCH_SIZE = 50;
const BASE_BACKOFF_MS = 1000;

/**
 * SyncService — Offline-first sync engine.
 *
 * Flow:
 *   1. Calls stored in SQLite with sync_status = PENDING
 *   2. Sync triggered by: network restore, app open, manual, WorkManager
 *   3. Batch upload to server with hash deduplication
 *   4. On success → SYNCED; on failure → exponential backoff retry
 */
@Injectable({
  providedIn: 'root',
})
export class SyncService {
  private syncing = false;
  private lastSyncAt = 0;
  private syncStatus$ = new BehaviorSubject<{
    syncing: boolean;
    pending: number;
    synced: number;
    total: number;
    lastError: string | null;
    lastSyncAt: number;
  }>({
    syncing: false,
    pending: 0,
    synced: 0,
    total: 0,
    lastError: null,
    lastSyncAt: 0,
  });

  constructor(
    private sqlite: SqliteService,
    private api: ApiService,
    private auth: AuthService,
    private network: NetworkMonitorService,
    private telemetry: TelemetryService
  ) {}

  get status$() {
    return this.syncStatus$.asObservable();
  }

  async prepareForSync(): Promise<void> {
    await this.sqlite.resetStaleSyncing();
    await this.sqlite.discardOutsideSyncWindow(getSyncWindowStartMs());
    await this.sqlite.resetFailedRetries(getSyncWindowStartMs());
    await this.refreshCounts();
  }

  /**
   * User removed a call from the phone dialer — keep and upload our copy.
   * Optionally pass cached call data from the native observer when the row
   * was never written to SQLite before deletion.
   */
  async preserveCallRemovedFromDevice(
    androidId: number,
    cachedCall?: CallLogEntry
  ): Promise<void> {
    if (cachedCall && isWithinSyncWindow(cachedCall.callTime)) {
      await this.upsertCallFromNative(cachedCall, false);
    }

    await this.sqlite.markCallDeleted(
      androidId,
      cachedCall ? toCallLogRecord(cachedCall) : undefined
    );
    await this.refreshCounts();
    if (this.network.isConnected()) {
      this.syncPending().catch(console.error);
    }
  }

  async upsertCallFromNative(
    entry: CallLogEntry,
    triggerSync = true
  ): Promise<boolean> {
    if (!isWithinSyncWindow(entry.callTime)) {
      return false;
    }

    const record = toCallLogRecord(entry);
    const existing =
      (await this.sqlite.getByHash(record.hash)) ??
      (await this.sqlite.getByAndroidId(record.androidId));

    if (!existing) {
      await this.sqlite.insertCall(record);
      await this.refreshCounts();
      if (triggerSync && this.network.isConnected()) {
        this.syncPending().catch(console.error);
      }
      return true;
    }

    const needsUpdate =
      existing.contactName !== record.contactName ||
      existing.duration !== record.duration ||
      existing.phoneNumber !== record.phoneNumber;

    if (!needsUpdate || !existing.id) return false;

    await this.sqlite.updateCallFields(existing.id, {
      contactName: record.contactName,
      duration: record.duration,
      phoneNumber: record.phoneNumber,
      markPending: true,
    });
    await this.refreshCounts();
    if (triggerSync && this.network.isConnected()) {
      this.syncPending().catch(console.error);
    }
    return true;
  }

  async saveCallFromNative(entry: CallLogEntry): Promise<void> {
    await this.upsertCallFromNative(entry);
  }

  async reconcileDeviceCalls(calls: CallLogEntry[]): Promise<number> {
    const recentCalls = calls.filter((call) => isWithinSyncWindow(call.callTime));
    const records = recentCalls.map(toCallLogRecord);
    const changed = await this.sqlite.reconcileBatch(records);

    const activeIds = recentCalls.map((c) => c.androidId);
    const windowStart = getSyncWindowStartMs();
    const deletedMarked = await this.sqlite.markDeletedNotInAndroidIds(
      activeIds,
      windowStart
    );
    const cachedDeleted = await this.importCachedDeletions(activeIds);
    const preserved = await this.sqlite.ensurePreservedForMissingFromPhone(
      activeIds,
      windowStart
    );

    await this.refreshCounts();
    const pending = await this.sqlite.getPendingCount(windowStart);
    if ((pending > 0 || deletedMarked > 0 || cachedDeleted > 0) && this.network.isConnected()) {
      this.syncPending().catch(console.error);
    }

    return changed + preserved + deletedMarked + cachedDeleted;
  }

  /** Queue deletions from native cache (calls uploaded in background, then removed from phone). */
  async importCachedDeletions(activeIds: number[]): Promise<number> {
    if (!Capacitor.isNativePlatform()) return 0;

    try {
      const { calls } = await CallLogSync.getCachedDeletionsFromPhone();
      if (!calls.length) return 0;

      const activeSet = new Set(activeIds);
      let marked = 0;

      for (const entry of calls) {
        if (activeSet.has(entry.androidId)) continue;

        const record = toCallLogRecord(entry);
        const ok = await this.sqlite.markCallDeleted(entry.androidId, record);
        if (ok) marked++;
      }

      return marked;
    } catch (error) {
      console.warn('[SyncService] importCachedDeletions failed:', error);
      return 0;
    }
  }

  async syncPending(allowCredentialRefresh = true): Promise<SyncBatchResult> {
    if (this.syncing) {
      return { synced: 0, failed: 0, duplicates: 0, errors: ['Sync already in progress'] };
    }

    if (!this.network.isConnected()) {
      return { synced: 0, failed: 0, duplicates: 0, errors: ['No internet connection'] };
    }

    const token = this.auth.getAccessToken();
    const apiKey = this.auth.getApiKey();
    if (!token || !apiKey) {
      return { synced: 0, failed: 0, duplicates: 0, errors: ['Not authenticated'] };
    }

    await this.sqlite.resetStaleSyncing();

    this.syncing = true;
    this.syncStatus$.next({ ...this.syncStatus$.value, syncing: true, lastError: null });

    const result: SyncBatchResult = {
      synced: 0,
      failed: 0,
      duplicates: 0,
      errors: [],
    };

    let deletionsConfirmed = 0;

    try {
      const windowStart = getSyncWindowStartMs();
      const pending = await this.sqlite.getPendingCalls(BATCH_SIZE, windowStart);
      const eligible = pending.filter(
        (r) => r.retryCount < MAX_RETRY && isWithinSyncWindow(r.callTime)
      );

      if (eligible.length === 0) {
        return result;
      }

      const ids = eligible.map((r) => r.id!).filter(Boolean);
      await this.sqlite.markSyncing(ids);

      const deviceId = this.auth.getDeviceId() ?? eligible[0].deviceId;
      const newCalls = eligible.filter((r) => !r.isDeleted);
      const deletedCalls = eligible.filter((r) => r.isDeleted);
      /** Deleted locally but never on server — must insert then delete in one batch. */
      const deletedNeedingUpsert = deletedCalls.filter((r) => !r.serverId);
      const callsToUpload = [...newCalls, ...deletedNeedingUpsert];

      if (!deviceId) {
        await this.sqlite.markPending(ids);
        result.errors.push('No device ID — re-register required');
        return result;
      }

      const toCallPayload = (r: CallLogRecord) => ({
        hash: r.hash,
        androidId: r.androidId,
        phoneNumber: r.phoneNumber,
        contactName: r.contactName,
        callType: r.callType,
        duration: r.duration,
        callTime: r.callTime,
        simSlot: r.simSlot,
      });

      const payload = {
        deviceId,
        calls: callsToUpload.map(toCallPayload),
        deletions: deletedCalls.map((r) => ({
          hash: r.hash,
          androidId: r.androidId,
        })),
      };

      if (payload.calls.length === 0 && payload.deletions.length === 0) {
        await this.sqlite.markPending(ids);
        return result;
      }

      try {
        const response = await this.api.batchSync(token, apiKey, payload);

        const syncedIds: number[] = [];
        const serverIdMap = new Map<number, string>();

        for (const synced of response.synced) {
          const record = callsToUpload.find((r) => r.hash === synced.hash);
          if (record?.id) {
            syncedIds.push(record.id);
            serverIdMap.set(record.id, synced.serverId);
          }
        }

        for (const dupHash of response.duplicates ?? []) {
          const record = callsToUpload.find((r) => r.hash === dupHash);
          if (record?.id) syncedIds.push(record.id);
        }

        const isDeletedLocal = (id: number): boolean =>
          eligible.find((r) => r.id === id)?.isDeleted ?? false;

        const activeSyncedIds = syncedIds.filter((id) => !isDeletedLocal(id));
        const activeDuplicateIds = (response.duplicates ?? [])
          .map((hash) => callsToUpload.find((r) => r.hash === hash)?.id)
          .filter((id): id is number => id != null && !isDeletedLocal(id));

        if (activeSyncedIds.length > 0 || activeDuplicateIds.length > 0) {
          await this.sqlite.markSynced(
            [...new Set([...activeSyncedIds, ...activeDuplicateIds])],
            serverIdMap
          );
        }

        result.synced = activeSyncedIds.length;
        result.duplicates = activeDuplicateIds.length;

        const deletedSyncedIds: number[] = [];
        for (const del of response.deleted ?? []) {
          const record = deletedCalls.find(
            (r) => r.hash === del.hash || r.androidId === del.androidId
          );
          if (record?.id) deletedSyncedIds.push(record.id);
        }
        if (deletedSyncedIds.length > 0) {
          deletionsConfirmed = deletedSyncedIds.length;
          await this.sqlite.markSynced(deletedSyncedIds, new Map());
          if (Capacitor.isNativePlatform()) {
            const androidIds = deletedCalls
              .filter((r) => r.id != null && deletedSyncedIds.includes(r.id))
              .map((r) => r.androidId);
            if (androidIds.length > 0) {
              await CallLogSync.clearCachedDeletions({ androidIds }).catch(console.error);
            }
          }
        }

        const failedHashes = new Set((response.failed ?? []).map((f) => f.hash));
        const failedIds = callsToUpload
          .filter((r) => failedHashes.has(r.hash))
          .map((r) => r.id!)
          .filter(Boolean);

        const deleteFailedIds = new Set(
          (response.deleteFailed ?? []).map((f) => f.androidId)
        );
        const failedDeletionIds = deletedCalls
          .filter((r) => deleteFailedIds.has(r.androidId))
          .map((r) => r.id!)
          .filter(Boolean);

        if (failedIds.length > 0) {
          await this.sqlite.markFailed(failedIds);
          result.failed = failedIds.length;
          result.errors.push(...(response.failed ?? []).map((f) => f.reason));
        }

        if (failedDeletionIds.length > 0) {
          await this.sqlite.markFailed(failedDeletionIds);
          result.failed += failedDeletionIds.length;
          result.errors.push(
            ...(response.deleteFailed ?? []).map((f) => f.reason)
          );
        }

        const processedIds = new Set([
          ...syncedIds,
          ...failedIds,
          ...deletedSyncedIds,
          ...failedDeletionIds,
        ]);
        const unprocessed = eligible.filter((r) => !processedIds.has(r.id!));
        const unprocessedNew = unprocessed.filter((r) => !r.isDeleted);
        const unprocessedDeleted = unprocessed.filter((r) => r.isDeleted);

        if (unprocessedNew.length > 0) {
          await this.sqlite.markSynced(
            unprocessedNew.map((r) => r.id!),
            new Map()
          );
          result.duplicates += unprocessedNew.length;
        }

        if (unprocessedDeleted.length > 0) {
          await this.sqlite.markPending(unprocessedDeleted.map((r) => r.id!));
          result.errors.push(
            `${unprocessedDeleted.length} deletion(s) not confirmed by server — will retry`
          );
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        const isInvalidApiKey = msg.includes('Invalid or inactive device API key');

        if (allowCredentialRefresh && isInvalidApiKey && this.auth.getDeviceId()) {
          await this.sqlite.markPending(ids);
          this.syncing = false;
          try {
            await this.auth.refreshDeviceRegistration();
            return this.syncPending(false);
          } catch (refreshError) {
            const refreshMsg =
              refreshError instanceof Error
                ? refreshError.message
                : String(refreshError);
            result.errors.push(`Re-register failed: ${refreshMsg}`);
          }
        }

        const backoff = this.calculateBackoff(eligible);
        await this.delay(backoff);
        await this.sqlite.markFailed(ids);
        result.failed = ids.length;
        result.errors.push(msg);
        this.syncStatus$.next({
          ...this.syncStatus$.value,
          lastError: msg,
        });
      }

      this.lastSyncAt = Date.now();

      const pendingAfter = await this.sqlite.getPendingCount(getSyncWindowStartMs());
      if (pendingAfter > 0 && (result.synced > 0 || deletionsConfirmed > 0)) {
        await this.syncPending();
      }
    } finally {
      this.syncing = false;
      await this.refreshCounts();
      this.telemetry.uploadIfDue().catch(console.error);
    }

    return result;
  }

  async importHistoricalCalls(calls: CallLogEntry[]): Promise<number> {
    return this.reconcileDeviceCalls(calls);
  }

  async getLocalCalls(
    limit = 50,
    offset = 0
  ): Promise<{ records: CallLogRecord[]; total: number; hasMore: boolean }> {
    return this.sqlite.getCalls(limit, offset, undefined, getSyncWindowStartMs());
  }

  async getDebugInfo() {
    return this.sqlite.getDebugInfo();
  }

  private async refreshCounts(): Promise<void> {
    const windowStart = getSyncWindowStartMs();
    const [pending, synced, total] = await Promise.all([
      this.sqlite.getPendingCount(windowStart),
      this.sqlite.getSyncedCount(),
      this.sqlite.getTotalCount(),
    ]);
    this.syncStatus$.next({
      ...this.syncStatus$.value,
      syncing: this.syncing,
      pending,
      synced,
      total,
      lastSyncAt: this.lastSyncAt,
    });
  }

  private calculateBackoff(records: CallLogRecord[]): number {
    const maxRetry = Math.max(...records.map((r) => r.retryCount), 0);
    return Math.min(BASE_BACKOFF_MS * Math.pow(2, maxRetry), 60_000);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
