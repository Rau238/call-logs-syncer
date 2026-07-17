import { registerPlugin } from '@capacitor/core';

import type { CallLogSyncPlugin } from './definitions';

/**
 * Plugin Registration
 * ─────────────────────
 * registerPlugin() creates a JavaScript proxy object.
 * When you call CallLogSync.echo({ value: 'test' }), Capacitor:
 *
 *   1. Serializes the arguments to JSON
 *   2. Sends them across the native bridge (WebView ↔ Android)
 *   3. Invokes the matching @PluginMethod in Kotlin
 *   4. Deserializes the Kotlin response back to a JavaScript Promise
 *
 * The string 'CallLogSync' MUST match:
 *   - The @CapacitorPlugin(name = "CallLogSync") annotation in Kotlin
 *   - The plugin name registered in capacitor.plugins.json (auto-generated)
 */
const CallLogSync = registerPlugin<CallLogSyncPlugin>('CallLogSync', {
  /**
   * Web fallback implementation.
   * Used when running in browser (ionic serve) where no native code exists.
   * See web.ts for the stub implementation.
   */
  web: () => import('./web').then((m) => new m.CallLogSyncWeb()),
});

export * from './definitions';
export { CallLogSync };
