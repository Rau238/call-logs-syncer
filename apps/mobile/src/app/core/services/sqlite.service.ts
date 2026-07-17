import { Injectable } from '@angular/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  SQLiteDBConnection,
} from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';

import { CallLogRecord, PaginatedCalls } from '../models/call-log.model';

const DB_NAME = 'call_log_sync.db';
const DB_VERSION = 2;

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS call_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  android_id INTEGER NOT NULL,
  phone_number TEXT NOT NULL,
  contact_name TEXT DEFAULT '',
  call_type TEXT NOT NULL,
  duration INTEGER DEFAULT 0,
  call_time INTEGER NOT NULL,
  sim_slot INTEGER DEFAULT -1,
  device_id TEXT NOT NULL,
  hash TEXT NOT NULL UNIQUE,
  sync_status TEXT DEFAULT 'PENDING',
  retry_count INTEGER DEFAULT 0,
  server_id TEXT,
  is_deleted INTEGER DEFAULT 0,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

const CREATE_INDEXES_SQL = [
  `CREATE INDEX IF NOT EXISTS idx_call_logs_sync_status ON call_logs(sync_status);`,
  `CREATE INDEX IF NOT EXISTS idx_call_logs_call_time ON call_logs(call_time DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_call_logs_hash ON call_logs(hash);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_call_logs_hash_unique ON call_logs(hash);`,
  `CREATE INDEX IF NOT EXISTS idx_call_logs_device_status ON call_logs(device_id, sync_status);`,
];

/**
 * SQLiteService — Repository pattern for offline call log storage.
 * All writes go to SQLite first (offline-first architecture).
 */
@Injectable({
  providedIn: 'root',
})
export class SqliteService {
  private sqlite: SQLiteConnection | null = null;
  private db: SQLiteDBConnection | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (!Capacitor.isNativePlatform()) {
      console.warn('[SqliteService] SQLite only available on native Android');
      this.initialized = true;
      return;
    }

    this.sqlite = new SQLiteConnection(CapacitorSQLite);
    const ret = await this.sqlite.checkConnectionsConsistency();
    const isConn = (await this.sqlite.isConnection(DB_NAME, false)).result;

    if (ret.result && isConn) {
      this.db = await this.sqlite.retrieveConnection(DB_NAME, false);
    } else {
      this.db = await this.sqlite.createConnection(
        DB_NAME,
        false,
        'no-encryption',
        DB_VERSION,
        false
      );
    }

    const openResult = await this.db.isDBOpen();
    if (!openResult.result) {
      await this.db.open();
    }

    await this.runMigrations();
    this.initialized = true;
    console.info('[SqliteService] Ready — DB:', DB_NAME);
  }

  isReady(): boolean {
    return this.initialized && this.db !== null;
  }

  async getDebugInfo(): Promise<{
    ready: boolean;
    native: boolean;
    total: number;
    pending: number;
    synced: number;
    failed: number;
  }> {
    const [total, pending, synced] = await Promise.all([
      this.getTotalCount(),
      this.getPendingCount(),
      this.getSyncedCount(),
    ]);

    let failed = 0;
    if (this.db) {
      const result = await this.db.query(
        `SELECT COUNT(*) as count FROM call_logs WHERE sync_status = 'FAILED';`
      );
      failed = Number(result.values?.[0]?.['count'] ?? 0);
    }

    return {
      ready: this.isReady(),
      native: Capacitor.isNativePlatform(),
      total,
      pending,
      synced,
      failed,
    };
  }

  private async runMigrations(): Promise<void> {
    if (!this.db) return;

    await this.db.execute(CREATE_TABLE_SQL);
    for (const indexSql of CREATE_INDEXES_SQL) {
      await this.db.execute(indexSql);
    }

    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY
      );
    `);

    const versionResult = await this.db.query(
      `SELECT version FROM schema_version LIMIT 1;`
    );
    let currentVersion = Number(versionResult.values?.[0]?.['version'] ?? 0);

    if (!versionResult.values?.length) {
      await this.db.run(`INSERT INTO schema_version (version) VALUES (?);`, [1]);
      currentVersion = 1;
    }

    if (currentVersion < 2) {
      try {
        await this.db.run(`ALTER TABLE call_logs ADD COLUMN is_deleted INTEGER DEFAULT 0;`);
      } catch {
        /* column may already exist */
      }
      try {
        await this.db.run(`ALTER TABLE call_logs ADD COLUMN deleted_at INTEGER;`);
      } catch {
        /* column may already exist */
      }
      await this.db.run(`UPDATE schema_version SET version = 2;`);
    }
  }

  /** One-query reconcile: import/update many calls without per-row lookups. */
  async reconcileBatch(records: CallLogRecord[]): Promise<number> {
    if (!this.db || records.length === 0) return 0;

    const existingResult = await this.db.query(
      `SELECT id, android_id, hash, contact_name, duration, phone_number
       FROM call_logs;`
    );
    const byHash = new Map<string, Record<string, unknown>>();
    const byAndroidId = new Map<number, Record<string, unknown>>();

    for (const row of existingResult.values ?? []) {
      byHash.set(String(row['hash']), row);
      byAndroidId.set(Number(row['android_id']), row);
    }

    let changed = 0;
    const now = Date.now();

    for (const record of records) {
      const existing =
        byHash.get(record.hash) ?? byAndroidId.get(record.androidId);

      if (!existing) {
        await this.db.run(
          `INSERT OR IGNORE INTO call_logs
            (android_id, phone_number, contact_name, call_type, duration,
             call_time, sim_slot, device_id, hash, sync_status, retry_count,
             server_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            record.androidId,
            record.phoneNumber,
            record.contactName,
            record.callType,
            record.duration,
            record.callTime,
            record.simSlot,
            record.deviceId,
            record.hash,
            record.syncStatus,
            record.retryCount,
            record.serverId,
            record.createdAt,
            record.updatedAt,
          ]
        );
        changed++;
        continue;
      }

      const existingId = Number(existing['id']);
      const needsUpdate =
        String(existing['contact_name'] ?? '') !== record.contactName ||
        Number(existing['duration'] ?? 0) !== record.duration ||
        String(existing['phone_number'] ?? '') !== record.phoneNumber;

      if (!needsUpdate) continue;

      await this.db.run(
        `UPDATE call_logs
         SET contact_name = ?, duration = ?, phone_number = ?,
             sync_status = 'PENDING', updated_at = ?
         WHERE id = ?;`,
        [record.contactName, record.duration, record.phoneNumber, now, existingId]
      );
      changed++;
    }

    return changed;
  }

  async insertCall(record: CallLogRecord): Promise<number | null> {
    if (!this.db) return null;

    try {
      const result = await this.db.run(
        `INSERT OR IGNORE INTO call_logs
          (android_id, phone_number, contact_name, call_type, duration,
           call_time, sim_slot, device_id, hash, sync_status, retry_count,
           server_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          record.androidId,
          record.phoneNumber,
          record.contactName,
          record.callType,
          record.duration,
          record.callTime,
          record.simSlot,
          record.deviceId,
          record.hash,
          record.syncStatus,
          record.retryCount,
          record.serverId,
          record.createdAt,
          record.updatedAt,
        ]
      );
      return result.changes?.lastId ?? null;
    } catch (error) {
      console.error('[SqliteService] insertCall failed:', error);
      return null;
    }
  }

  async updateCallFields(
    id: number,
    fields: {
      contactName?: string;
      duration?: number;
      phoneNumber?: string;
      markPending?: boolean;
    }
  ): Promise<boolean> {
    if (!this.db) return false;

    const now = Date.now();
    const sets: string[] = ['updated_at = ?'];
    const params: (string | number)[] = [now];

    if (fields.contactName !== undefined) {
      sets.push('contact_name = ?');
      params.push(fields.contactName);
    }
    if (fields.duration !== undefined) {
      sets.push('duration = ?');
      params.push(fields.duration);
    }
    if (fields.phoneNumber !== undefined) {
      sets.push('phone_number = ?');
      params.push(fields.phoneNumber);
    }
    if (fields.markPending) {
      sets.push(`sync_status = 'PENDING'`);
    }

    params.push(id);
    const result = await this.db.run(
      `UPDATE call_logs SET ${sets.join(', ')} WHERE id = ?;`,
      params
    );
    return (result.changes?.changes ?? 0) > 0;
  }

  async markDeletedNotInAndroidIds(activeIds: number[]): Promise<number> {
    if (!this.db) return 0;

    const now = Date.now();
    if (activeIds.length === 0) {
      const result = await this.db.run(
        `UPDATE call_logs
         SET is_deleted = 1, deleted_at = ?, sync_status = 'PENDING', updated_at = ?
         WHERE is_deleted = 0;`,
        [now, now]
      );
      return result.changes?.changes ?? 0;
    }

    const placeholders = activeIds.map(() => '?').join(',');
    const result = await this.db.run(
      `UPDATE call_logs
       SET is_deleted = 1, deleted_at = ?, sync_status = 'PENDING', updated_at = ?
       WHERE is_deleted = 0 AND android_id NOT IN (${placeholders});`,
      [now, now, ...activeIds]
    );
    return result.changes?.changes ?? 0;
  }

  async getPendingCalls(limit = 100, windowStartMs?: number): Promise<CallLogRecord[]> {
    if (!this.db) return [];

    const since = windowStartMs ?? 0;
    const result = await this.db.query(
      `SELECT * FROM call_logs
       WHERE sync_status IN ('PENDING', 'FAILED')
         AND call_time >= ?
       ORDER BY call_time ASC
       LIMIT ?;`,
      [since, limit]
    );

    return (result.values ?? []).map(this.mapRow);
  }

  async getCalls(
    limit = 50,
    offset = 0,
    syncStatus?: string,
    windowStartMs?: number
  ): Promise<PaginatedCalls> {
    if (!this.db) {
      return { records: [], total: 0, hasMore: false };
    }

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (syncStatus) {
      conditions.push(`sync_status = ?`);
      params.push(syncStatus);
    }
    if (windowStartMs != null) {
      conditions.push(`call_time >= ?`);
      params.push(windowStartMs);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await this.db.query(
      `SELECT COUNT(*) as total FROM call_logs ${whereClause};`,
      params
    );
    const total = Number(countResult.values?.[0]?.['total'] ?? 0);

    const dataResult = await this.db.query(
      `SELECT * FROM call_logs ${whereClause}
       ORDER BY call_time DESC
       LIMIT ? OFFSET ?;`,
      [...params, limit, offset]
    );

    const records = (dataResult.values ?? []).map(this.mapRow);
    return {
      records,
      total,
      hasMore: offset + records.length < total,
    };
  }

  async markSynced(ids: number[], serverIds: Map<number, string>): Promise<void> {
    if (!this.db || ids.length === 0) return;

    const now = Date.now();
    const withServerId = ids.filter((id) => serverIds.has(id));
    const withoutServerId = ids.filter((id) => !serverIds.has(id));

    if (withServerId.length > 0) {
      for (const id of withServerId) {
        await this.db.run(
          `UPDATE call_logs
           SET sync_status = 'SYNCED', server_id = ?, updated_at = ?, retry_count = 0
           WHERE id = ?;`,
          [serverIds.get(id) ?? null, now, id]
        );
      }
    }

    if (withoutServerId.length > 0) {
      await this.markStatusForIds(withoutServerId, 'SYNCED', now, {
        retryCount: 0,
      });
    }
  }

  async markFailed(ids: number[]): Promise<void> {
    if (!this.db || ids.length === 0) return;
    await this.markStatusForIds(ids, 'FAILED', Date.now(), { incrementRetry: true });
  }

  async markPending(ids: number[]): Promise<void> {
    if (!this.db || ids.length === 0) return;
    await this.markStatusForIds(ids, 'PENDING', Date.now());
  }

  async markSyncing(ids: number[]): Promise<void> {
    if (!this.db || ids.length === 0) return;
    await this.markStatusForIds(ids, 'SYNCING', Date.now());
  }

  private async markStatusForIds(
    ids: number[],
    status: string,
    updatedAt: number,
    options?: { retryCount?: number; incrementRetry?: boolean }
  ): Promise<void> {
    if (!this.db || ids.length === 0) return;

    const placeholders = ids.map(() => '?').join(',');
    const params: (string | number)[] = [status, updatedAt];

    let setClause = `sync_status = ?, updated_at = ?`;
    if (options?.retryCount !== undefined) {
      setClause += `, retry_count = ?`;
      params.push(options.retryCount);
    } else if (options?.incrementRetry) {
      setClause += `, retry_count = retry_count + 1`;
    }

    params.push(...ids);
    await this.db.run(
      `UPDATE call_logs SET ${setClause} WHERE id IN (${placeholders});`,
      params
    );
  }

  /** Recover rows stuck in SYNCING after a crash mid-upload. */
  async resetStaleSyncing(maxAgeMs = 5 * 60 * 1000): Promise<number> {
    if (!this.db) return 0;

    const cutoff = Date.now() - maxAgeMs;
    const result = await this.db.run(
      `UPDATE call_logs
       SET sync_status = 'PENDING', updated_at = ?
       WHERE sync_status = 'SYNCING' AND updated_at < ?;`,
      [Date.now(), cutoff]
    );
    return result.changes?.changes ?? 0;
  }

  async getTotalCount(): Promise<number> {
    if (!this.db) return 0;

    const result = await this.db.query(`SELECT COUNT(*) as count FROM call_logs;`);
    return Number(result.values?.[0]?.['count'] ?? 0);
  }

  async getByAndroidId(androidId: number): Promise<CallLogRecord | null> {
    if (!this.db) return null;

    const result = await this.db.query(
      `SELECT * FROM call_logs WHERE android_id = ? LIMIT 1;`,
      [androidId]
    );
    if (!result.values?.length) return null;
    return this.mapRow(result.values[0]);
  }

  async markCallDeleted(androidId: number): Promise<boolean> {
    if (!this.db) return false;

    const now = Date.now();
    const result = await this.db.run(
      `UPDATE call_logs
       SET is_deleted = 1, deleted_at = ?, sync_status = 'PENDING', updated_at = ?
       WHERE android_id = ? AND is_deleted = 0;`,
      [now, now, androidId]
    );
    return (result.changes?.changes ?? 0) > 0;
  }

  async getByHash(hash: string): Promise<CallLogRecord | null> {
    if (!this.db) return null;

    const result = await this.db.query(
      `SELECT * FROM call_logs WHERE hash = ? LIMIT 1;`,
      [hash]
    );
    if (!result.values?.length) return null;
    return this.mapRow(result.values[0]);
  }

  /** Drop local rows outside the sync window so old history is never uploaded. */
  async discardOutsideSyncWindow(windowStartMs: number): Promise<number> {
    if (!this.db) return 0;

    const result = await this.db.run(
      `DELETE FROM call_logs
       WHERE call_time < ?
         AND sync_status IN ('PENDING', 'FAILED', 'SYNCING');`,
      [windowStartMs]
    );
    return result.changes?.changes ?? 0;
  }

  /**
   * Calls saved locally but no longer on the phone (user deleted from call log).
   * Keep the record and queue upload — do NOT tombstone on the server.
   */
  async ensurePreservedForMissingFromPhone(
    activeAndroidIds: number[],
    windowStartMs: number
  ): Promise<number> {
    if (!this.db || activeAndroidIds.length === 0) return 0;

    const placeholders = activeAndroidIds.map(() => '?').join(',');
    const result = await this.db.query(
      `SELECT id FROM call_logs
       WHERE call_time >= ?
         AND is_deleted = 0
         AND sync_status IN ('PENDING', 'FAILED')
         AND android_id NOT IN (${placeholders});`,
      [windowStartMs, ...activeAndroidIds]
    );

    const ids = (result.values ?? []).map((row) => Number(row['id']));
    if (ids.length === 0) return 0;

    await this.markPending(ids);
    return ids.length;
  }

  /** Give failed rows within the sync window another upload attempt. */
  async resetFailedRetries(windowStartMs: number): Promise<number> {
    if (!this.db) return 0;

    const result = await this.db.run(
      `UPDATE call_logs
       SET sync_status = 'PENDING', retry_count = 0, updated_at = ?
       WHERE sync_status = 'FAILED' AND call_time >= ?;`,
      [Date.now(), windowStartMs]
    );
    return result.changes?.changes ?? 0;
  }

  async getPendingCount(windowStartMs?: number): Promise<number> {
    if (!this.db) return 0;

    if (windowStartMs != null) {
      const result = await this.db.query(
        `SELECT COUNT(*) as count FROM call_logs
         WHERE sync_status IN ('PENDING', 'FAILED')
           AND call_time >= ?;`,
        [windowStartMs]
      );
      return Number(result.values?.[0]?.['count'] ?? 0);
    }

    const result = await this.db.query(
      `SELECT COUNT(*) as count FROM call_logs
       WHERE sync_status IN ('PENDING', 'FAILED');`
    );
    return Number(result.values?.[0]?.['count'] ?? 0);
  }

  async getSyncedCount(): Promise<number> {
    if (!this.db) return 0;

    const result = await this.db.query(
      `SELECT COUNT(*) as count FROM call_logs WHERE sync_status = 'SYNCED';`
    );
    return Number(result.values?.[0]?.['count'] ?? 0);
  }

  private mapRow(row: Record<string, unknown>): CallLogRecord {
    return {
      id: Number(row['id']),
      androidId: Number(row['android_id']),
      phoneNumber: String(row['phone_number'] ?? ''),
      contactName: String(row['contact_name'] ?? ''),
      callType: row['call_type'] as CallLogRecord['callType'],
      duration: Number(row['duration'] ?? 0),
      callTime: Number(row['call_time']),
      simSlot: Number(row['sim_slot'] ?? -1),
      deviceId: String(row['device_id']),
      hash: String(row['hash']),
      syncStatus: row['sync_status'] as CallLogRecord['syncStatus'],
      retryCount: Number(row['retry_count'] ?? 0),
      serverId: row['server_id'] ? String(row['server_id']) : null,
      isDeleted: Boolean(row['is_deleted']),
      deletedAt: row['deleted_at'] ? Number(row['deleted_at']) : null,
      createdAt: Number(row['created_at']),
      updatedAt: Number(row['updated_at']),
    };
  }
}
