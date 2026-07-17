# Parts 2–18 — Complete Implementation Guide

> **Status:** ✅ Implemented in codebase  
> **Companion:** Part 1 → `PART-01-CAPACITOR-PLUGIN.md`

---

## Table of Contents

- [Part 2: Android / Kotlin Basics](#part-2)
- [Part 3: Read Call Log](#part-3)
- [Part 4: Real-Time Detection](#part-4)
- [Part 5: Events to Ionic](#part-5)
- [Part 6: SQLite Storage](#part-6)
- [Part 7: Offline First](#part-7)
- [Part 8: Sync Engine](#part-8)
- [Part 9: Network Detection](#part-9)
- [Part 10: Background Sync](#part-10)
- [Part 11: Node Backend](#part-11)
- [Part 12: MySQL Schema](#part-12)
- [Part 13: Security](#part-13)
- [Part 14: Performance](#part-14)
- [Part 15: Permissions](#part-15)
- [Part 16: Testing](#part-16)
- [Part 17: Error Handling](#part-17)
- [Part 18: Production Deployment](#part-18)

---

<a id="part-2"></a>
## Part 2 — Android / Kotlin Basics

### Core Concepts (with diagrams)

```
┌─────────────┐     uses      ┌──────────────────┐
│   Activity  │──────────────▶│     Context      │
│  (UI layer) │               │ (app resources)  │
└─────────────┘               └────────┬─────────┘
                                       │
                              ┌────────▼─────────┐
                              │ ContentResolver  │
                              │  (query URIs)    │
                              └────────┬─────────┘
                                       │
                              ┌────────▼─────────┐
                              │     Cursor       │
                              │  (result rows)   │
                              └──────────────────┘
```

| Concept | Purpose in this project |
|---------|------------------------|
| **Class** | `CallLogReader`, `CallLogChangeDetector` — encapsulate logic |
| **Function** | `@PluginMethod fun readCallLog()` — bridge entry points |
| **Variable / val / var** | `val` = immutable (preferred), `var` = mutable state |
| **Nullable `?`** | `cursor.getString(index) ?: ""` — safe null handling |
| **Context** | Access ContentResolver, SharedPreferences, WorkManager |
| **ContentResolver** | Query `CallLog.Calls.CONTENT_URI` |
| **Cursor** | Iterate call log rows |
| **URI** | `content://call_log/calls` — Android data address |
| **ContentObserver** | Real-time call log change detection |
| **Handler / Looper** | Thread-safe callbacks on main thread |
| **Coroutines** | WorkManager worker async execution |
| **WorkManager** | 15-minute periodic background sync |

### Section Summary
Kotlin classes in `call-log-sync-plugin/android/` implement the native layer using modern Android APIs (API 30+).

### Best Practices
- Prefer `val` over `var`
- Always close Cursors with `.use { }`
- Never block the main thread — offload Cursor reads to background threads

### Common Mistakes
- Forgetting to unregister ContentObserver → memory leak
- Reading CallLog on UI thread → ANR

### Interview Questions
1. What is the difference between `Context` and `Activity`?
2. Why must Cursors be closed?
3. What thread does ContentObserver run on?

---

<a id="part-3"></a>
## Part 3 — Read Call Log

### Implementation Files
- `CallLogReader.kt` — ContentProvider queries with pagination
- `CallLogMapper.kt` — Maps Android types → JSON
- `ContactNameResolver.kt` — Contact name lookup
- `CallLogHashUtil.kt` — SHA-256 deduplication hash

### Call Types Supported
| Android Constant | JSON Value |
|-----------------|------------|
| INCOMING_TYPE (1) | INCOMING |
| OUTGOING_TYPE (2) | OUTGOING |
| MISSED_TYPE (3) | MISSED |
| VOICEMAIL_TYPE (4) | VOICEMAIL |
| REJECTED_TYPE (5) | REJECTED |
| BLOCKED_TYPE (6) | BLOCKED |

### JSON Shape (Kotlin → Ionic)
```json
{
  "androidId": 12345,
  "phoneNumber": "+919876543210",
  "contactName": "John Doe",
  "callType": "INCOMING",
  "duration": 120,
  "callTime": 1720000000000,
  "simSlot": 0,
  "deviceId": "abc123",
  "hash": "sha256..."
}
```

### Section Summary
`readCallLog({ limit, offset, since })` queries the Android CallLog ContentProvider and returns paginated JSON.

### Best Practices
- Normalize phone numbers server-side
- Use `CACHED_NAME` first, then Contacts lookup
- Cap `limit` at 500 to prevent OOM

### Common Mistakes
- Not checking READ_CALL_LOG before query
- Assuming `NUMBER` is never null

### Real-World Example
Enterprise field sales app imports last 200 calls on first launch via `readCallLog({ limit: 200 })`.

---

<a id="part-4"></a>
## Part 4 — Real-Time Detection (ContentObserver)

### Lifecycle Diagram
```
startObserver()
    │
    ▼
registerContentObserver(CallLog.Calls.CONTENT_URI)
    │
    ▼
[Phone Call Happens]
    │
    ▼
onChange() fired on Handler thread
    │
    ▼
Background Thread: query _ID > lastProcessedId
    │
    ▼
Deduplicate by hash → notifyListeners("newCall")
    │
    ▼
stopObserver() / handleOnDestroy()
    │
    ▼
unregisterContentObserver() ← CRITICAL (prevents memory leak)
```

### Implementation: `CallLogChangeDetector.kt`
- Watermark-based detection (`lastProcessedId`)
- Hash-based deduplication (`seenHashes` set)
- Best-effort delete detection via ID set comparison

### Section Summary
ContentObserver provides near-instant detection when Android inserts a new CallLog row.

### Best Practices
- Initialize watermark to latest `_ID` to skip historical entries
- Use `notifyListeners` on main thread via Handler.post
- Always unregister in `handleOnDestroy()`

### Common Mistakes
- Registering observer without permission → SecurityException
- Emitting duplicate events on rapid onChange bursts

---

<a id="part-5"></a>
## Part 5 — Events to Ionic

### TypeScript Listener Examples
```typescript
// New call detected
const handle = await CallLogSync.addListener('newCall', (call) => {
  console.log('New call:', call.phoneNumber, call.callType);
});

// Background sync requested by WorkManager
await CallLogSync.addListener('backgroundSync', async () => {
  await syncService.syncPending();
});

// Cleanup
await handle.remove();
await CallLogSync.removeAllListeners();
```

### Events Emitted
| Event | Payload | When |
|-------|---------|------|
| `newCall` | `CallLogEntry` | New row in CallLog |
| `callUpdated` | `CallLogEntry` | Row modified (rare) |
| `callDeleted` | `{ androidId, hash }` | Row removed from Phone app |
| `backgroundSync` | `{ trigger, timestamp }` | WorkManager tick |

### Section Summary
`notifyListeners()` pushes native events to Ionic without polling.

---

<a id="part-6"></a>
## Part 6 — SQLite Storage

### Schema
```sql
CREATE TABLE call_logs (
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
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

### Indexes
- `idx_call_logs_sync_status` — fast pending query
- `idx_call_logs_call_time` — chronological display
- `idx_call_logs_hash_unique` — deduplication

### Repository: `SqliteService`
Implements insert, getPending, markSynced, markFailed, pagination.

---

<a id="part-7"></a>
## Part 7 — Offline First Architecture

```
Phone Call
    ↓
ContentObserver (native)
    ↓
notifyListeners → Ionic listener
    ↓
SQLite INSERT (sync_status = PENDING)    ← ALWAYS FIRST
    ↓
[Separate process]
SyncService.syncPending() → API (only when online)
```

**Golden Rule:** Never call API directly from the call detection path. Always write to SQLite first.

---

<a id="part-8"></a>
## Part 8 — Sync Engine

### Features (`SyncService`)
| Feature | Implementation |
|---------|---------------|
| Queue | `getPendingCalls()` ordered by call_time ASC |
| Batch Upload | 50 records per request |
| Exponential Backoff | `1000ms × 2^retryCount`, max 60s |
| Max Retry | 5 attempts |
| Duplicate Prevention | Hash UNIQUE in SQLite + server UNIQUE |
| Partial Success | Per-record success/fail in batch response |
| Rollback | MySQL transaction in `batchSync` |

---

<a id="part-9"></a>
## Part 9 — Network Detection

Uses `@capacitor/network`:
```typescript
Network.addListener('networkStatusChange', (status) => {
  if (status.connected) syncService.syncPending();
});
```

---

<a id="part-10"></a>
## Part 10 — Background Sync (WorkManager)

### Triggers
| Trigger | Mechanism |
|---------|-----------|
| Every 15 min | `PeriodicWorkRequest` (Android minimum) |
| App open | `App.addListener('resume')` |
| Internet restored | `NetworkMonitorService` |
| Manual | Dashboard "Sync Now" button |
| Device restart | WorkManager persists across reboots |

### Battery / Doze
- WorkManager respects Doze mode — batches work in maintenance windows
- Avoid WakeLocks — let WorkManager schedule optimally
- Exempt from battery optimization only if business-critical (enterprise MDM)

---

<a id="part-11"></a>
## Part 11 — Node Backend

See `call-log-backend/README.md` for full API documentation.

---

<a id="part-12"></a>
## Part 12 — MySQL Schema

See `call-log-backend/migrations/001_initial.sql`

### ER Diagram
```
users (1) ──── (N) devices (1) ──── (N) call_logs
                      │
                      └──── (N) sync_audit
```

---

<a id="part-13"></a>
## Part 13 — Security

| Layer | Mechanism |
|-------|-----------|
| Transport | HTTPS (production) |
| Auth | JWT Bearer tokens |
| Device | API Key (HMAC-hashed in DB) |
| Replay | Hash uniqueness + sync_audit |
| Rate Limiting | express-rate-limit (100/15min) |
| Headers | Helmet.js |

---

<a id="part-14"></a>
## Part 14 — Performance (100,000+ records)

- Cursor pagination (`limit`/`offset`)
- Batch sync (50 per request)
- SQLite indexes on sync_status, call_time, hash
- Background thread for ContentProvider reads
- `INSERT OR IGNORE` for hash dedup

---

<a id="part-15"></a>
## Part 15 — Permissions

| Permission | Purpose | Required |
|-----------|---------|----------|
| READ_CALL_LOG | Read call history | Yes |
| READ_PHONE_STATE | SIM slot detection | Yes |
| READ_CONTACTS | Contact name lookup | Recommended |
| POST_NOTIFICATIONS | Android 13+ notifications | Optional |

### Request Flow
```
checkPermissions() → requestPermissions() → sequential dialogs → callback
```

---

<a id="part-16"></a>
## Part 16 — Testing

| Layer | Tool | Target |
|-------|------|--------|
| Plugin | JUnit + Robolectric | CallLogMapper, HashUtil |
| SQLite | Jasmine | SqliteService |
| Sync | Jasmine + HttpClientTesting | SyncService |
| API | Jest + supertest | Express routes |
| Load | k6 or Artillery | batch-sync endpoint |

---

<a id="part-17"></a>
## Part 17 — Error Handling

| Error | Handling |
|-------|----------|
| No Internet | Skip sync, keep PENDING |
| Permission Denied | `call.reject('PERMISSION_DENIED')` |
| Cursor null | Return empty list |
| SQLite failure | Log + retry on next event |
| API timeout | Exponential backoff |
| Duplicate | `INSERT OR IGNORE` / server 409 |
| Server 500 | markFailed + retry |

---

<a id="part-18"></a>
## Part 18 — Production Deployment

### Checklist
- [ ] Change JWT_SECRET and API_KEY_SALT
- [ ] Enable HTTPS on backend
- [ ] Set `environment.prod.ts` API URL
- [ ] Change default admin password
- [ ] Set `minSdkVersion = 30`
- [ ] ProGuard rules for release build
- [ ] MDM deployment for enterprise devices
- [ ] Privacy policy + user consent flow

---

## Architecture Diagram

See `docs/ARCHITECTURE.md`

## Sequence Diagram

```
User → Phone App → Android CallLog DB
                      ↓
              ContentObserver.onChange()
                      ↓
              CallLogChangeDetector
                      ↓
              notifyListeners("newCall")
                      ↓
              Ionic CallLogPluginService
                      ↓
              SyncService.saveCallFromNative()
                      ↓
              SQLite (PENDING)
                      ↓
         [Network Available / WorkManager / Manual]
                      ↓
              SyncService.syncPending()
                      ↓
              POST /api/v1/call-log/batch-sync
                      ↓
              MySQL → markSynced()
```
