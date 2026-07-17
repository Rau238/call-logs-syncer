import { PoolClient } from 'pg';
import { query, withTransaction } from '../config/database';
import { generateServerUuid } from '../utils/crypto';
import { logger } from '../utils/logger';

export interface CallLogInput {
  deviceId: string;
  hash: string;
  androidId: number;
  phoneNumber: string;
  contactName: string;
  callType: string;
  duration: number;
  callTime: number;
  simSlot: number;
}

export interface SyncResult {
  synced: Array<{ hash: string; serverId: string }>;
  duplicates: string[];
  failed: Array<{ hash: string; reason: string }>;
  deleted: Array<{ hash: string; androidId: number }>;
  deleteFailed: Array<{ androidId: number; reason: string }>;
}

interface CallLogRow {
  id: number;
  server_uuid: string;
  hash: string;
  device_id: string;
  android_id: number;
  phone_number: string;
  contact_name: string;
  call_type: string;
  duration: number;
  call_time: number;
  sim_slot: number;
  created_at: Date;
  is_deleted?: boolean;
  deleted_at?: Date | null;
}

export class CallLogService {
  async syncSingle(call: CallLogInput): Promise<{ serverId: string } | 'duplicate'> {
    const existing = await query<{ server_uuid: string }>(
      `SELECT server_uuid FROM call_logs WHERE hash = $1 LIMIT 1`,
      [call.hash]
    );

    if (existing.length) return 'duplicate';

    const serverUuid = generateServerUuid();
    await query(
      `INSERT INTO call_logs
        (device_id, server_uuid, android_id, phone_number, contact_name,
         call_type, duration, call_time, sim_slot, hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        call.deviceId,
        serverUuid,
        call.androidId,
        call.phoneNumber,
        call.contactName,
        call.callType,
        call.duration,
        call.callTime,
        call.simSlot,
        call.hash,
      ]
    );

    return { serverId: serverUuid };
  }

  async batchSync(
    deviceId: string,
    calls: Omit<CallLogInput, 'deviceId'>[],
    deletions: Array<{ hash?: string; androidId: number }> = [],
    ipAddress?: string
  ): Promise<SyncResult> {
    const result: SyncResult = {
      synced: [],
      duplicates: [],
      failed: [],
      deleted: [],
      deleteFailed: [],
    };

    await withTransaction(async (client: PoolClient) => {
      for (let i = 0; i < calls.length; i++) {
        const call = calls[i];
        const savepoint = `sync_call_${i}`;
        await client.query(`SAVEPOINT ${savepoint}`);
        try {
          const existing = await client.query(
            `SELECT server_uuid FROM call_logs WHERE hash = $1 LIMIT 1`,
            [call.hash]
          );

          if (existing.rows.length) {
            await client.query(
              `UPDATE call_logs
               SET contact_name = $1, duration = $2, updated_at = NOW()
               WHERE hash = $3
                 AND (contact_name IS DISTINCT FROM $1 OR duration IS DISTINCT FROM $2)`,
              [call.contactName, call.duration, call.hash]
            );
            result.duplicates.push(call.hash);
          } else {
            const serverUuid = generateServerUuid();
            await client.query(
              `INSERT INTO call_logs
                (device_id, server_uuid, android_id, phone_number, contact_name,
                 call_type, duration, call_time, sim_slot, hash)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
              [
                deviceId,
                serverUuid,
                call.androidId,
                call.phoneNumber,
                call.contactName,
                call.callType,
                call.duration,
                call.callTime,
                call.simSlot,
                call.hash,
              ]
            );

            result.synced.push({ hash: call.hash, serverId: serverUuid });
          }

          await client.query(`RELEASE SAVEPOINT ${savepoint}`);
        } catch (error) {
          await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
          const reason = error instanceof Error ? error.message : 'Unknown error';
          logger.warn('Call sync row failed', { hash: call.hash, reason });
          result.failed.push({ hash: call.hash, reason });
        }
      }

      for (let i = 0; i < deletions.length; i++) {
        const deletion = deletions[i];
        const savepoint = `sync_del_${i}`;
        await client.query(`SAVEPOINT ${savepoint}`);
        try {
          let updateResult;
          if (deletion.hash) {
            updateResult = await client.query(
              `UPDATE call_logs
               SET is_deleted = TRUE, deleted_at = NOW(), updated_at = NOW()
               WHERE device_id = $1 AND hash = $2 AND is_deleted = FALSE
               RETURNING hash, android_id`,
              [deviceId, deletion.hash]
            );
          } else {
            updateResult = await client.query(
              `UPDATE call_logs
               SET is_deleted = TRUE, deleted_at = NOW(), updated_at = NOW()
               WHERE device_id = $1 AND android_id = $2 AND is_deleted = FALSE
               RETURNING hash, android_id`,
              [deviceId, deletion.androidId]
            );
          }

          if (updateResult.rows.length) {
            const row = updateResult.rows[0];
            result.deleted.push({
              hash: row.hash,
              androidId: Number(row.android_id),
            });
          }

          await client.query(`RELEASE SAVEPOINT ${savepoint}`);
        } catch (error) {
          await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
          result.deleteFailed.push({
            androidId: deletion.androidId,
            reason: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      const batchSize = calls.length + deletions.length;
      await client.query(
        `INSERT INTO sync_audit (device_id, batch_size, synced_count, failed_count, ip_address)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          deviceId,
          batchSize,
          result.synced.length + result.deleted.length,
          result.failed.length + result.deleteFailed.length,
          ipAddress ?? null,
        ]
      );

      await client.query(
        `UPDATE devices SET last_seen_at = NOW(), updated_at = NOW() WHERE device_id = $1`,
        [deviceId]
      );
    }).catch((error) => {
      logger.error('Batch sync transaction failed', { error, deviceId });
      throw error;
    });

    return result;
  }

  async getHistory(
    deviceId: string,
    page: number,
    pageSize: number
  ): Promise<{ calls: CallLogRow[]; total: number; hasMore: boolean }> {
    const offset = (page - 1) * pageSize;

    const countResult = await query<{ total: string }>(
      `SELECT COUNT(*)::int AS total FROM call_logs WHERE device_id = $1`,
      [deviceId]
    );
    const total = Number(countResult[0]?.total ?? 0);

    const calls = await query<CallLogRow>(
      `SELECT * FROM call_logs WHERE device_id = $1
       ORDER BY call_time DESC
       LIMIT $2 OFFSET $3`,
      [deviceId, pageSize, offset]
    );

    return { calls, total, hasMore: offset + calls.length < total };
  }

  async getPending(
    deviceId: string,
    page: number,
    pageSize: number
  ): Promise<{ calls: CallLogRow[]; total: number; hasMore: boolean }> {
    return this.getHistory(deviceId, page, pageSize);
  }

  async getAllCalls(
    page: number,
    pageSize: number,
    deviceId?: string,
    search?: string,
    options?: {
      deletedOnly?: boolean;
      activeOnly?: boolean;
      callType?: string;
    }
  ): Promise<{
    calls: Array<CallLogRow & { device_name: string | null }>;
    total: number;
    hasMore: boolean;
  }> {
    const offset = (page - 1) * pageSize;
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (deviceId) {
      conditions.push(`c.device_id = $${paramIndex++}`);
      params.push(deviceId);
    }
    if (search) {
      conditions.push(
        `(c.phone_number ILIKE $${paramIndex} OR c.contact_name ILIKE $${paramIndex})`
      );
      params.push(`%${search}%`);
      paramIndex++;
    }
    if (options?.deletedOnly) {
      conditions.push(`c.is_deleted = TRUE`);
    } else if (options?.activeOnly) {
      conditions.push(`c.is_deleted = FALSE`);
    }
    if (options?.callType) {
      conditions.push(`c.call_type = $${paramIndex++}`);
      params.push(options.callType);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query<{ total: string }>(
      `SELECT COUNT(*)::int AS total FROM call_logs c ${where}`,
      params
    );
    const total = Number(countResult[0]?.total ?? 0);

    const calls = await query<CallLogRow & { device_name: string | null }>(
      `SELECT c.*, d.device_name
       FROM call_logs c
       LEFT JOIN devices d ON d.device_id = c.device_id
       ${where}
       ORDER BY c.call_time DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, pageSize, offset]
    );

    return { calls, total, hasMore: offset + calls.length < total };
  }

  async getDashboardStats(): Promise<{
    totalCalls: number;
    totalDevices: number;
    activeDevices: number;
    callsToday: number;
    syncBatchesToday: number;
    activeCalls: number;
    deletedCalls: number;
    deletedToday: number;
    pendingSyncFailures: number;
    totalDurationSeconds: number;
    lastSyncAt: string | null;
  }> {
    const [
      calls,
      devices,
      active,
      todayCalls,
      todaySyncs,
      activeCalls,
      deletedCalls,
      deletedToday,
      duration,
      lastSync,
    ] = await Promise.all([
      query<{ count: string }>(`SELECT COUNT(*)::int AS count FROM call_logs`),
      query<{ count: string }>(`SELECT COUNT(*)::int AS count FROM devices`),
      query<{ count: string }>(
        `SELECT COUNT(*)::int AS count FROM devices WHERE is_active = TRUE`
      ),
      query<{ count: string }>(
        `SELECT COUNT(*)::int AS count FROM call_logs
         WHERE call_time >= EXTRACT(EPOCH FROM CURRENT_DATE)::bigint * 1000`
      ),
      query<{ count: string }>(
        `SELECT COUNT(*)::int AS count FROM sync_audit
         WHERE created_at >= CURRENT_DATE`
      ),
      query<{ count: string }>(
        `SELECT COUNT(*)::int AS count FROM call_logs WHERE is_deleted = FALSE`
      ),
      query<{ count: string }>(
        `SELECT COUNT(*)::int AS count FROM call_logs WHERE is_deleted = TRUE`
      ),
      query<{ count: string }>(
        `SELECT COUNT(*)::int AS count FROM call_logs
         WHERE is_deleted = TRUE AND deleted_at >= CURRENT_DATE`
      ),
      query<{ total: string }>(
        `SELECT COALESCE(SUM(duration), 0)::int AS total FROM call_logs WHERE is_deleted = FALSE`
      ),
      query<{ created_at: Date }>(
        `SELECT created_at FROM sync_audit ORDER BY created_at DESC LIMIT 1`
      ),
    ]);

    const todayFailed = await query<{ count: string }>(
      `SELECT COALESCE(SUM(failed_count), 0)::int AS count FROM sync_audit
       WHERE created_at >= CURRENT_DATE`
    );

    return {
      totalCalls: Number(calls[0]?.count ?? 0),
      totalDevices: Number(devices[0]?.count ?? 0),
      activeDevices: Number(active[0]?.count ?? 0),
      callsToday: Number(todayCalls[0]?.count ?? 0),
      syncBatchesToday: Number(todaySyncs[0]?.count ?? 0),
      activeCalls: Number(activeCalls[0]?.count ?? 0),
      deletedCalls: Number(deletedCalls[0]?.count ?? 0),
      deletedToday: Number(deletedToday[0]?.count ?? 0),
      pendingSyncFailures: Number(todayFailed[0]?.count ?? 0),
      totalDurationSeconds: Number(duration[0]?.total ?? 0),
      lastSyncAt: lastSync[0]?.created_at?.toISOString() ?? null,
    };
  }

  async getAllDevices(): Promise<
    Array<{
      device_id: string;
      device_name: string;
      is_active: boolean;
      last_seen_at: Date | null;
      telemetry_at: Date | null;
      telemetry: Record<string, unknown>;
      call_count: number;
      deleted_count: number;
    }>
  > {
    return query(
      `SELECT d.device_id, d.device_name, d.is_active, d.last_seen_at,
              d.telemetry_at, COALESCE(d.telemetry, '{}'::jsonb) AS telemetry,
              COUNT(c.id)::int AS call_count,
              COUNT(c.id) FILTER (WHERE c.is_deleted)::int AS deleted_count
       FROM devices d
       LEFT JOIN call_logs c ON c.device_id = d.device_id
       GROUP BY d.id
       ORDER BY d.last_seen_at DESC NULLS LAST`
    );
  }

  async deleteByServerId(serverId: string): Promise<boolean> {
    const result = await query<{ server_uuid: string }>(
      `DELETE FROM call_logs WHERE server_uuid = $1 RETURNING server_uuid`,
      [serverId]
    );
    return result.length > 0;
  }

  async deleteMany(serverIds: string[]): Promise<{
    deleted: number;
    notFound: string[];
  }> {
    if (serverIds.length === 0) {
      return { deleted: 0, notFound: [] };
    }

    const result = await query<{ server_uuid: string }>(
      `DELETE FROM call_logs WHERE server_uuid = ANY($1::uuid[]) RETURNING server_uuid`,
      [serverIds]
    );

    const deletedIds = new Set(result.map((r) => r.server_uuid));
    const notFound = serverIds.filter((id) => !deletedIds.has(id));

    return { deleted: result.length, notFound };
  }

  async getAnalytics(): Promise<{
    callsByType: Array<{ callType: string; count: number }>;
    callsByDay: Array<{ date: string; count: number; deleted: number }>;
    callsByHour: Array<{ hour: number; count: number }>;
    topNumbers: Array<{
      phoneNumber: string;
      contactName: string;
      callCount: number;
      totalDuration: number;
      deletedCount: number;
      lastCallTime: number;
    }>;
    deviceActivity: Array<{
      deviceId: string;
      deviceName: string;
      callCount: number;
      deletedCount: number;
      lastSeenAt: string | null;
    }>;
  }> {
    const [byType, byDay, byHour, topNumbers, deviceActivity] = await Promise.all([
      query<{ call_type: string; count: string }>(
        `SELECT call_type, COUNT(*)::int AS count
         FROM call_logs GROUP BY call_type ORDER BY count DESC`
      ),
      query<{ date: string; count: string; deleted: string }>(
        `SELECT TO_CHAR(TO_TIMESTAMP(call_time / 1000), 'YYYY-MM-DD') AS date,
                COUNT(*)::int AS count,
                COUNT(*) FILTER (WHERE is_deleted)::int AS deleted
         FROM call_logs
         WHERE call_time >= (EXTRACT(EPOCH FROM CURRENT_DATE - INTERVAL '13 days') * 1000)
         GROUP BY date ORDER BY date ASC`
      ),
      query<{ hour: string; count: string }>(
        `SELECT EXTRACT(HOUR FROM TO_TIMESTAMP(call_time / 1000))::int AS hour,
                COUNT(*)::int AS count
         FROM call_logs
         WHERE call_time >= (EXTRACT(EPOCH FROM CURRENT_DATE - INTERVAL '7 days') * 1000)
         GROUP BY hour ORDER BY hour ASC`
      ),
      query<{
        phone_number: string;
        contact_name: string;
        call_count: string;
        total_duration: string;
        deleted_count: string;
        last_call_time: string;
      }>(
        `SELECT phone_number,
                MAX(contact_name) AS contact_name,
                COUNT(*)::int AS call_count,
                COALESCE(SUM(duration), 0)::int AS total_duration,
                COUNT(*) FILTER (WHERE is_deleted)::int AS deleted_count,
                MAX(call_time)::bigint AS last_call_time
         FROM call_logs
         GROUP BY phone_number
         ORDER BY call_count DESC
         LIMIT 25`
      ),
      query<{
        device_id: string;
        device_name: string;
        call_count: string;
        deleted_count: string;
        last_seen_at: Date | null;
      }>(
        `SELECT d.device_id, d.device_name,
                COUNT(c.id)::int AS call_count,
                COUNT(c.id) FILTER (WHERE c.is_deleted)::int AS deleted_count,
                d.last_seen_at
         FROM devices d
         LEFT JOIN call_logs c ON c.device_id = d.device_id
         GROUP BY d.id
         ORDER BY call_count DESC`
      ),
    ]);

    return {
      callsByType: byType.map((r) => ({
        callType: r.call_type,
        count: Number(r.count),
      })),
      callsByDay: byDay.map((r) => ({
        date: r.date,
        count: Number(r.count),
        deleted: Number(r.deleted),
      })),
      callsByHour: byHour.map((r) => ({
        hour: Number(r.hour),
        count: Number(r.count),
      })),
      topNumbers: topNumbers.map((r) => ({
        phoneNumber: r.phone_number,
        contactName: r.contact_name || '',
        callCount: Number(r.call_count),
        totalDuration: Number(r.total_duration),
        deletedCount: Number(r.deleted_count),
        lastCallTime: Number(r.last_call_time),
      })),
      deviceActivity: deviceActivity.map((r) => ({
        deviceId: r.device_id,
        deviceName: r.device_name,
        callCount: Number(r.call_count),
        deletedCount: Number(r.deleted_count),
        lastSeenAt: r.last_seen_at?.toISOString() ?? null,
      })),
    };
  }

  async getContactsGrouped(
    page: number,
    pageSize: number,
    search?: string
  ): Promise<{
    contacts: Array<{
      phoneNumber: string;
      contactName: string;
      callCount: number;
      incoming: number;
      outgoing: number;
      missed: number;
      deletedCount: number;
      totalDuration: number;
      lastCallTime: number;
      devices: string[];
    }>;
    total: number;
    hasMore: boolean;
  }> {
    const offset = (page - 1) * pageSize;
    const params: unknown[] = [];
    let searchClause = '';
    if (search) {
      params.push(`%${search}%`);
      searchClause = `WHERE phone_number ILIKE $1 OR contact_name ILIKE $1`;
    }

    const countResult = await query<{ total: string }>(
      `SELECT COUNT(*)::int AS total FROM (
         SELECT phone_number FROM call_logs ${searchClause} GROUP BY phone_number
       ) t`,
      params
    );
    const total = Number(countResult[0]?.total ?? 0);

    const limitParam = params.length + 1;
    const offsetParam = params.length + 2;

    const rows = await query<{
      phone_number: string;
      contact_name: string;
      call_count: string;
      incoming: string;
      outgoing: string;
      missed: string;
      deleted_count: string;
      total_duration: string;
      last_call_time: string;
      devices: string[];
    }>(
      `SELECT phone_number,
              MAX(contact_name) AS contact_name,
              COUNT(*)::int AS call_count,
              COUNT(*) FILTER (WHERE call_type = 'INCOMING')::int AS incoming,
              COUNT(*) FILTER (WHERE call_type = 'OUTGOING')::int AS outgoing,
              COUNT(*) FILTER (WHERE call_type = 'MISSED')::int AS missed,
              COUNT(*) FILTER (WHERE is_deleted)::int AS deleted_count,
              COALESCE(SUM(duration), 0)::int AS total_duration,
              MAX(call_time)::bigint AS last_call_time,
              ARRAY_AGG(DISTINCT device_id) AS devices
       FROM call_logs
       ${searchClause}
       GROUP BY phone_number
       ORDER BY call_count DESC, last_call_time DESC
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      [...params, pageSize, offset]
    );

    return {
      contacts: rows.map((r) => ({
        phoneNumber: r.phone_number,
        contactName: r.contact_name || '',
        callCount: Number(r.call_count),
        incoming: Number(r.incoming),
        outgoing: Number(r.outgoing),
        missed: Number(r.missed),
        deletedCount: Number(r.deleted_count),
        totalDuration: Number(r.total_duration),
        lastCallTime: Number(r.last_call_time),
        devices: r.devices ?? [],
      })),
      total,
      hasMore: offset + rows.length < total,
    };
  }

  async getSyncAudit(
    page: number,
    pageSize: number,
    deviceId?: string
  ): Promise<{
    entries: Array<{
      id: number;
      deviceId: string;
      deviceName: string | null;
      batchSize: number;
      syncedCount: number;
      failedCount: number;
      ipAddress: string | null;
      createdAt: string;
    }>;
    total: number;
    hasMore: boolean;
  }> {
    const offset = (page - 1) * pageSize;
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (deviceId) {
      conditions.push(`a.device_id = $${paramIndex++}`);
      params.push(deviceId);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query<{ total: string }>(
      `SELECT COUNT(*)::int AS total FROM sync_audit a ${where}`,
      params
    );
    const total = Number(countResult[0]?.total ?? 0);

    const rows = await query<{
      id: number;
      device_id: string;
      device_name: string | null;
      batch_size: number;
      synced_count: number;
      failed_count: number;
      ip_address: string | null;
      created_at: Date;
    }>(
      `SELECT a.*, d.device_name
       FROM sync_audit a
       LEFT JOIN devices d ON d.device_id = a.device_id
       ${where}
       ORDER BY a.created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, pageSize, offset]
    );

    return {
      entries: rows.map((r) => ({
        id: r.id,
        deviceId: r.device_id,
        deviceName: r.device_name,
        batchSize: r.batch_size,
        syncedCount: r.synced_count,
        failedCount: r.failed_count,
        ipAddress: r.ip_address,
        createdAt: r.created_at.toISOString(),
      })),
      total,
      hasMore: offset + rows.length < total,
    };
  }

  async saveDeviceTelemetry(
    deviceId: string,
    telemetry: Record<string, unknown>
  ): Promise<void> {
    await query(
      `UPDATE devices
       SET telemetry = $2::jsonb,
           telemetry_at = NOW(),
           last_seen_at = NOW(),
           updated_at = NOW()
       WHERE device_id = $1`,
      [deviceId, JSON.stringify(telemetry)]
    );
  }

  async getDeviceDetail(deviceId: string): Promise<{
    device: {
      device_id: string;
      device_name: string;
      is_active: boolean;
      last_seen_at: Date | null;
      telemetry_at: Date | null;
      telemetry: Record<string, unknown>;
      call_count: number;
      deleted_count: number;
      active_count: number;
    } | null;
    recentCalls: Array<CallLogRow & { device_name: string | null }>;
  }> {
    const devices = await query<{
      device_id: string;
      device_name: string;
      is_active: boolean;
      last_seen_at: Date | null;
      telemetry_at: Date | null;
      telemetry: Record<string, unknown>;
      call_count: string;
      deleted_count: string;
      active_count: string;
    }>(
      `SELECT d.device_id, d.device_name, d.is_active, d.last_seen_at,
              d.telemetry_at, COALESCE(d.telemetry, '{}'::jsonb) AS telemetry,
              COUNT(c.id)::int AS call_count,
              COUNT(c.id) FILTER (WHERE c.is_deleted)::int AS deleted_count,
              COUNT(c.id) FILTER (WHERE NOT c.is_deleted)::int AS active_count
       FROM devices d
       LEFT JOIN call_logs c ON c.device_id = d.device_id
       WHERE d.device_id = $1
       GROUP BY d.id`,
      [deviceId]
    );

    if (!devices.length) {
      return { device: null, recentCalls: [] };
    }

    const d = devices[0];
    const recentCalls = await query<CallLogRow & { device_name: string | null }>(
      `SELECT c.*, d.device_name
       FROM call_logs c
       LEFT JOIN devices d ON d.device_id = c.device_id
       WHERE c.device_id = $1
       ORDER BY c.call_time DESC
       LIMIT 20`,
      [deviceId]
    );

    return {
      device: {
        device_id: d.device_id,
        device_name: d.device_name,
        is_active: d.is_active,
        last_seen_at: d.last_seen_at,
        telemetry_at: d.telemetry_at,
        telemetry: d.telemetry ?? {},
        call_count: Number(d.call_count),
        deleted_count: Number(d.deleted_count),
        active_count: Number(d.active_count),
      },
      recentCalls,
    };
  }

  async getLiveSnapshot(): Promise<{
    totalCalls: number;
    callsToday: number;
    deletedCalls: number;
    lastSyncAt: string | null;
    lastCallAt: number | null;
    activeDevices: number;
    syncBatchesLastHour: number;
  }> {
    const [totals, lastSync, lastCall, active, batches] = await Promise.all([
      query<{
        total: string;
        today: string;
        deleted: string;
      }>(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (
                  WHERE call_time >= EXTRACT(EPOCH FROM CURRENT_DATE)::bigint * 1000
                )::int AS today,
                COUNT(*) FILTER (WHERE is_deleted)::int AS deleted
         FROM call_logs`
      ),
      query<{ created_at: Date }>(
        `SELECT created_at FROM sync_audit ORDER BY created_at DESC LIMIT 1`
      ),
      query<{ call_time: string }>(
        `SELECT MAX(call_time)::bigint AS call_time FROM call_logs`
      ),
      query<{ count: string }>(
        `SELECT COUNT(*)::int AS count FROM devices WHERE is_active = TRUE`
      ),
      query<{ count: string }>(
        `SELECT COUNT(*)::int AS count FROM sync_audit
         WHERE created_at >= NOW() - INTERVAL '1 hour'`
      ),
    ]);

    return {
      totalCalls: Number(totals[0]?.total ?? 0),
      callsToday: Number(totals[0]?.today ?? 0),
      deletedCalls: Number(totals[0]?.deleted ?? 0),
      lastSyncAt: lastSync[0]?.created_at?.toISOString() ?? null,
      lastCallAt: lastCall[0]?.call_time ? Number(lastCall[0].call_time) : null,
      activeDevices: Number(active[0]?.count ?? 0),
      syncBatchesLastHour: Number(batches[0]?.count ?? 0),
    };
  }
}
