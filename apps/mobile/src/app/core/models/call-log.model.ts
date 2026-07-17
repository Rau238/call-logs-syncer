import { CallLogEntry, CallType, SyncStatus } from 'call-log-sync';

/** Local SQLite record — extends native entry with sync metadata */
export interface CallLogRecord {
  id?: number;
  androidId: number;
  phoneNumber: string;
  contactName: string;
  callType: CallType;
  duration: number;
  callTime: number;
  simSlot: number;
  deviceId: string;
  hash: string;
  syncStatus: SyncStatus;
  retryCount: number;
  serverId: string | null;
  isDeleted: boolean;
  deletedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

/** Maps native plugin entry → local SQLite record */
export function toCallLogRecord(entry: CallLogEntry): CallLogRecord {
  const now = Date.now();
  return {
    androidId: entry.androidId,
    phoneNumber: entry.phoneNumber,
    contactName: entry.contactName,
    callType: entry.callType,
    duration: entry.duration,
    callTime: entry.callTime,
    simSlot: entry.simSlot,
    deviceId: entry.deviceId,
    hash: entry.hash,
    syncStatus: 'PENDING',
    retryCount: 0,
    serverId: null,
    isDeleted: false,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export interface SyncBatchResult {
  synced: number;
  failed: number;
  duplicates: number;
  errors: string[];
}

export interface PaginatedCalls {
  records: CallLogRecord[];
  total: number;
  hasMore: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

export interface DeviceRegistration {
  deviceId: string;
  deviceName: string;
  apiKey: string;
}
