# System Architecture

## Component Diagram

```mermaid
graph TB
    subgraph Android["Android Device"]
        CL[CallLog ContentProvider]
        CO[ContentObserver]
        PL[CallLogSyncPlugin Kotlin]
        WM[WorkManager Worker]
    end

    subgraph Ionic["Ionic Angular App"]
        PS[CallLogPluginService]
        SS[SqliteService]
        SY[SyncService]
        NM[NetworkMonitorService]
        UI[Call Log Dashboard]
    end

    subgraph Backend["Node.js Backend"]
        API[Express API]
        AUTH[JWT + API Key Auth]
        MYSQL[(MySQL)]
    end

    CL --> CO
    CO --> PL
    PL -->|notifyListeners| PS
    WM -->|broadcast| PL
    PS --> SS
    PS --> SY
    NM -->|on reconnect| SY
    SS -->|PENDING records| SY
    SY -->|batch-sync| API
    API --> AUTH
    AUTH --> MYSQL
    UI --> PS
    UI --> SY
```

## Class Diagram (Simplified)

```mermaid
classDiagram
    class CallLogSyncPlugin {
        +echo()
        +readCallLog()
        +startObserver()
        +stopObserver()
        +getDeviceId()
    }
    class CallLogReader {
        +read(limit, offset, since)
        +readNewerThan(androidId)
    }
    class CallLogChangeDetector {
        +start()
        +stop()
        -processChanges()
    }
    class SqliteService {
        +insertCall()
        +getPendingCalls()
        +markSynced()
    }
    class SyncService {
        +saveCallFromNative()
        +syncPending()
    }
    class CallLogService {
        +batchSync()
        +syncSingle()
        +getHistory()
    }

    CallLogSyncPlugin --> CallLogReader
    CallLogSyncPlugin --> CallLogChangeDetector
    CallLogChangeDetector --> CallLogReader
    SyncService --> SqliteService
    SyncService --> CallLogService
```

## ER Diagram

```mermaid
erDiagram
    users ||--o{ devices : owns
    devices ||--o{ call_logs : generates
    devices ||--o{ sync_audit : logs

    users {
        bigint id PK
        varchar email UK
        varchar password_hash
        enum role
    }
    devices {
        bigint id PK
        varchar device_id UK
        varchar api_key_hash UK
        tinyint is_active
    }
    call_logs {
        bigint id PK
        varchar device_id FK
        char server_uuid UK
        char hash UK
        bigint call_time
        enum call_type
    }
    sync_audit {
        bigint id PK
        varchar device_id
        int batch_size
        int synced_count
    }
```

## Data Flow

```mermaid
sequenceDiagram
    participant Phone
    participant CallLog as Android CallLog
    participant Observer as ContentObserver
    participant Plugin as Kotlin Plugin
    participant Ionic as Ionic App
    participant SQLite
    participant API as Node API
    participant DB as MySQL

    Phone->>CallLog: Insert new call row
    CallLog->>Observer: onChange()
    Observer->>Plugin: readNewerThan(lastId)
    Plugin->>Ionic: notifyListeners("newCall")
    Ionic->>SQLite: INSERT hash, status=PENDING
    Note over Ionic,SQLite: User deletes from Phone — SQLite retains copy
    Ionic->>API: POST /batch-sync (when online)
    API->>DB: INSERT with hash dedup
    DB-->>API: server_uuid
    API-->>Ionic: synced[] response
    Ionic->>SQLite: UPDATE status=SYNCED
```

## Folder Structure

```
call-log-sync-system/
├── call-log-app/                    # Ionic Angular host
│   └── src/app/
│       ├── core/
│       │   ├── models/              # TypeScript interfaces
│       │   └── services/            # SQLite, Sync, API, Auth
│       └── features/
│           └── call-log/            # Dashboard UI
├── call-log-sync-plugin/            # Capacitor plugin
│   ├── src/                         # TS bridge (definitions, index)
│   └── android/src/main/java/       # Kotlin native code
├── call-log-backend/                # Node.js API
│   ├── migrations/                  # MySQL schema
│   └── src/                         # Express routes, services
└── docs/                            # Module documentation
```
