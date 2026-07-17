# call-log-sync

Production-ready Capacitor plugin for Android Call Log synchronization.

## Install

```bash
npm install call-log-sync
npx cap sync
```

## Usage

```typescript
import { CallLogSync } from 'call-log-sync';

// Test the bridge (Part 1)
const result = await CallLogSync.echo({ value: 'Hello from Ionic!' });
console.log(result.value); // "Hello from Ionic!"

// Check permissions
const perms = await CallLogSync.checkPermissions();
console.log(perms.readCallLog); // true | false
```

## Android Requirements

- minSdk: 30 (Android 11)
- targetSdk: 35 (Android 15)
- Kotlin 1.9+
- Permissions: READ_CALL_LOG, READ_PHONE_STATE, READ_CONTACTS, POST_NOTIFICATIONS

## Architecture

See `/docs/PART-01-CAPACITOR-PLUGIN.md` for full documentation.
