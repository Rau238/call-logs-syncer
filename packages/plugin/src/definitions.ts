/**
 * Call Log Sync Plugin — TypeScript API Definitions
 *
 * This file defines the CONTRACT between Ionic (JavaScript/TypeScript)
 * and the native Android plugin (Kotlin).
 *
 * Every method and event declared here MUST have a matching
 * implementation on the Android side (annotated with @PluginMethod
 * or emitted via notifyListeners).
 */

/** Supported call types mapped from Android CallLog.Calls */
export type CallType =
  | 'INCOMING'
  | 'OUTGOING'
  | 'MISSED'
  | 'REJECTED'
  | 'BLOCKED'
  | 'VOICEMAIL'
  | 'UNKNOWN';

/** Sync status used by Ionic SQLite layer */
export type SyncStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';

/**
 * A single call log entry returned from native Android.
 * This is the JSON shape sent from Kotlin → Ionic.
 */
export interface CallLogEntry {
  /** Android CallLog._ID */
  androidId: number;
  /** Normalized phone number (E.164 when possible) */
  phoneNumber: string;
  /** Contact display name from ContactsContract, or empty string */
  contactName: string;
  /** Cached label from call log (Home, Mobile, etc.) */
  cachedNumberLabel?: string;
  /** Geocoded location from carrier, if available */
  geocodedLocation?: string;
  /** ISO country code for the number */
  countryIso?: string;
  /** Android phone account ID for dual-SIM devices */
  phoneAccountId?: string;
  /** Call direction/type */
  callType: CallType;
  /** Duration in seconds */
  duration: number;
  /** Unix timestamp in milliseconds */
  callTime: number;
  /** SIM slot index (0 or 1 for dual-SIM), -1 if unknown */
  simSlot: number;
  /** Unique device identifier (Android ID + app salt) */
  deviceId: string;
  /**
   * SHA-256 hash for deduplication:
   * hash(deviceId + phoneNumber + callTime + duration + callType)
   */
  hash: string;
}

/** Options for reading call log history */
export interface ReadCallLogOptions {
  /** Max records to return (default: 50) */
  limit?: number;
  /** Offset for pagination (default: 0) */
  offset?: number;
  /** Only return calls after this timestamp (ms) */
  since?: number;
}

/** Result of readCallLog() */
export interface ReadCallLogResult {
  calls: CallLogEntry[];
  total: number;
  hasMore: boolean;
}

/** Permission check result */
export interface PermissionStatus {
  readCallLog: boolean;
  readPhoneState: boolean;
  readContacts: boolean;
  postNotifications: boolean;
}

/** Network connection details from native Android */
export interface NetworkInfo {
  connected: boolean;
  connectionType: 'wifi' | 'cellular' | 'ethernet' | 'none' | 'unknown';
  networkName: string;
}

/** Options for starting real-time observer */
export interface StartObserverOptions {
  /** Emit events for calls already in log (default: false) */
  includeExisting?: boolean;
}

/** Native plugin runtime status for debugging */
export interface PluginStatus {
  observerActive: boolean;
  contactsObserverActive: boolean;
  backgroundSyncConfigured: boolean;
  backgroundSyncPending: boolean;
  trackedCallsCount: number;
  lastNativeSyncAt: number;
  deviceId: string;
  permissions: PermissionStatus;
}

/** Plugin method + event interface */
export interface CallLogSyncPlugin {
  /**
   * Echo test — verifies the Capacitor bridge is working.
   * Part 1 learning method; removed in production.
   */
  echo(options: { value: string }): Promise<{ value: string }>;

  /**
   * Check if required Android permissions are granted.
   */
  checkPermissions(): Promise<PermissionStatus>;

  /**
   * Request required runtime permissions.
   */
  requestPermissions(): Promise<PermissionStatus>;

  /**
   * Read call log entries from Android ContentProvider.
   * Implemented fully in Part 3.
   */
  readCallLog(options?: ReadCallLogOptions): Promise<ReadCallLogResult>;

  /**
   * Start ContentObserver for real-time call detection.
   * Implemented in Part 4.
   */
  startObserver(options?: StartObserverOptions): Promise<{ started: boolean }>;

  /**
   * Stop ContentObserver and release resources.
   */
  stopObserver(): Promise<{ stopped: boolean }>;

  /**
   * Get unique device identifier for server registration.
   */
  getDeviceId(): Promise<{ deviceId: string }>;

  /**
   * Get native plugin runtime status (observer, background sync, permissions).
   */
  getPluginStatus(): Promise<PluginStatus>;

  /** Wi‑Fi / mobile network type and name (SSID or carrier). */
  getNetworkInfo(): Promise<NetworkInfo>;

  /**
   * Cached calls already uploaded but removed from the phone dialer.
   * Used to sync deletion status to the server.
   */
  getCachedDeletionsFromPhone(): Promise<{ calls: CallLogEntry[]; count: number }>;

  /** Remove entries from native cache after deletion sync succeeds. */
  clearCachedDeletions(options: { androidIds: number[] }): Promise<{ cleared: number }>;

  /** Schedule WorkManager periodic sync (15 min minimum interval). */
  scheduleBackgroundSync(): Promise<{ scheduled: boolean }>;

  /** Cancel WorkManager periodic sync. */
  cancelBackgroundSync(): Promise<{ cancelled: boolean }>;

  /** Check if WorkManager requested a background sync. */
  isBackgroundSyncPending(): Promise<{ pending: boolean }>;

  /** Clear the WorkManager sync pending flag. */
  clearBackgroundSyncPending(): Promise<{ cleared: boolean }>;

  /**
   * Configure silent native background sync (no notification).
   * Saves API credentials for WorkManager to sync when app is closed.
   */
  configureBackgroundSync(options: {
    apiUrl: string;
    token: string;
    apiKey: string;
    deviceId: string;
  }): Promise<{ configured: boolean }>;

  /**
   * Register listener for new call events.
   * Event name: 'newCall'
   */
  addListener(
    eventName: 'newCall',
    listenerFunc: (call: CallLogEntry) => void
  ): Promise<import('@capacitor/core').PluginListenerHandle>;

  /**
   * Register listener for updated call events.
   * Event name: 'callUpdated'
   */
  addListener(
    eventName: 'callUpdated',
    listenerFunc: (call: CallLogEntry) => void
  ): Promise<import('@capacitor/core').PluginListenerHandle>;

  /**
   * Register listener for deleted call events (best-effort).
   * Event name: 'callDeleted'
   */
  addListener(
    eventName: 'callDeleted',
    listenerFunc: (data: {
      androidId: number;
      hash: string;
      deviceId?: string;
      call?: CallLogEntry;
    }) => void
  ): Promise<import('@capacitor/core').PluginListenerHandle>;

  /**
   * Fired when WorkManager requests a background sync.
   * Event name: 'backgroundSync'
   */
  addListener(
    eventName: 'backgroundSync',
    listenerFunc: (data: { trigger: string; timestamp: number }) => void
  ): Promise<import('@capacitor/core').PluginListenerHandle>;

  /** Remove all listeners */
  removeAllListeners(): Promise<void>;
}
