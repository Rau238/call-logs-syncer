package com.enterprisecalllog.plugin

import android.database.ContentObserver
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.CallLog
import android.provider.ContactsContract
import android.util.Log
import com.getcapacitor.Bridge
import com.getcapacitor.JSObject
import java.util.Collections
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong

/**
 * Observes CallLog + Contacts changes and emits events to Ionic.
 */
class CallLogChangeDetector(
    private val plugin: CallLogSyncPlugin,
    private val bridge: Bridge,
    private val callLogReader: CallLogReader,
    private val contactNameResolver: ContactNameResolver?,
    private val deviceId: String
) {
    companion object {
        private const val TAG = "CallLogChangeDetector"
        private const val MAX_BATCH = 50
        private const val DELETION_SCAN_MS = 30_000L
    }

    private val handler = Handler(Looper.getMainLooper())
    private val isRunning = AtomicBoolean(false)
    private val lastProcessedId = AtomicLong(0L)
    private val seenHashes = Collections.synchronizedSet(mutableSetOf<String>())
    private val trackedAndroidIds = Collections.synchronizedSet(mutableSetOf<Long>())
    private val snapshotByAndroidId = Collections.synchronizedMap(mutableMapOf<Long, String>())
    private val trackedEntries = Collections.synchronizedMap(mutableMapOf<Long, JSObject>())
    private var callLogObserver: ContentObserver? = null
    private var contactsObserver: ContentObserver? = null
    private val deletionScanRunnable = Runnable { scheduleProcessChanges() }

    fun start(includeExisting: Boolean = false) {
        if (!isRunning.compareAndSet(false, true)) {
            Log.d(TAG, "Observer already running")
            return
        }

        if (includeExisting) {
            seedExistingEntries()
        } else {
            seedTrackedIds()
            initializeWatermark()
        }

        callLogObserver = object : ContentObserver(handler) {
            override fun onChange(selfChange: Boolean) {
                onChange(selfChange, null)
            }

            override fun onChange(selfChange: Boolean, uri: Uri?) {
                if (!isRunning.get()) return
                scheduleProcessChanges()
            }
        }

        bridge.activity?.contentResolver?.registerContentObserver(
            CallLog.Calls.CONTENT_URI,
            true,
            callLogObserver!!
        )

        if (contactNameResolver != null) {
            contactsObserver = object : ContentObserver(handler) {
                override fun onChange(selfChange: Boolean) {
                    onChange(selfChange, null)
                }

                override fun onChange(selfChange: Boolean, uri: Uri?) {
                    if (!isRunning.get()) return
                    contactNameResolver.clearCache()
                    scheduleContactRefresh()
                }
            }

            bridge.activity?.contentResolver?.registerContentObserver(
                ContactsContract.Contacts.CONTENT_URI,
                true,
                contactsObserver!!
            )
            Log.d(TAG, "Contacts ContentObserver registered")
        }

        handler.postDelayed(deletionScanRunnable, DELETION_SCAN_MS)
        Log.d(TAG, "CallLog ContentObserver registered")
    }

    fun stop() {
        if (!isRunning.compareAndSet(true, false)) return

        handler.removeCallbacks(deletionScanRunnable)

        callLogObserver?.let { obs ->
            try {
                bridge.activity?.contentResolver?.unregisterContentObserver(obs)
            } catch (e: Exception) {
                Log.w(TAG, "Failed to unregister call log observer", e)
            }
        }
        callLogObserver = null

        contactsObserver?.let { obs ->
            try {
                bridge.activity?.contentResolver?.unregisterContentObserver(obs)
            } catch (e: Exception) {
                Log.w(TAG, "Failed to unregister contacts observer", e)
            }
        }
        contactsObserver = null

        Log.d(TAG, "Observers unregistered")
    }

    fun isActive(): Boolean = isRunning.get()

    fun getTrackedCount(): Int = trackedAndroidIds.size

    fun isContactsObserverActive(): Boolean = contactsObserver != null && isRunning.get()

    private fun scheduleProcessChanges() {
        Thread {
            try {
                processChanges()
            } catch (e: Exception) {
                Log.e(TAG, "Error processing call log changes", e)
            }
        }.start()
    }

    private fun scheduleContactRefresh() {
        Thread {
            try {
                refreshTrackedContactNames()
            } catch (e: Exception) {
                Log.e(TAG, "Error refreshing contact names", e)
            }
        }.start()
    }

    private fun seedTrackedIds() {
        val since = SyncConfig.syncWindowStartMs()
        val recent = callLogReader.read(limit = 300, offset = 0, since = since)
        recent.calls.forEach { entry ->
            rememberEntry(entry)
        }
    }

    private fun initializeWatermark() {
        bridge.activity?.contentResolver?.query(
            CallLog.Calls.CONTENT_URI,
            arrayOf(CallLog.Calls._ID),
            null,
            null,
            "${CallLog.Calls._ID} DESC"
        )?.use { cursor ->
            if (cursor.moveToFirst()) {
                lastProcessedId.set(cursor.getLong(0))
            }
        }
    }

    private fun seedExistingEntries() {
        initializeWatermark()
        val since = SyncConfig.syncWindowStartMs()
        val recent = callLogReader.read(limit = 100, offset = 0, since = since)
        recent.calls.forEach { entry ->
            trackAndEmit(entry, eventName = "newCall", force = false)
        }
    }

    private fun processChanges() {
        val since = SyncConfig.syncWindowStartMs()
        val newCalls = callLogReader.readNewerThan(lastProcessedId.get(), MAX_BATCH, since)
        newCalls.forEach { entry ->
            trackAndEmit(entry, eventName = "newCall", force = true)
        }

        scanRecentForUpdates()
        detectDeletions()

        if (isRunning.get()) {
            handler.removeCallbacks(deletionScanRunnable)
            handler.postDelayed(deletionScanRunnable, DELETION_SCAN_MS)
        }
    }

    /** Detect duration/contact changes on existing rows (e.g. call ended, contact renamed). */
    private fun scanRecentForUpdates() {
        val since = SyncConfig.syncWindowStartMs()
        val recent = callLogReader.read(limit = 100, offset = 0, since = since)
        recent.calls.forEach { entry ->
            val androidId = entry.getLong("androidId")
            if (!trackedAndroidIds.contains(androidId)) return@forEach

            val previous = snapshotByAndroidId[androidId]
            val current = entrySnapshot(entry)
            if (previous != null && previous != current) {
                trackAndEmit(entry, eventName = "callUpdated", force = true)
            } else if (previous == null) {
                rememberEntry(entry)
            }
        }
    }

    private fun refreshTrackedContactNames() {
        val ids = trackedAndroidIds.toList()
        ids.forEach { androidId ->
            val entry = callLogReader.readByAndroidId(androidId) ?: return@forEach
            val previous = snapshotByAndroidId[androidId]
            val current = entrySnapshot(entry)
            if (previous != null && previous != current) {
                trackAndEmit(entry, eventName = "callUpdated", force = true)
            }
        }
    }

    private fun trackAndEmit(entry: JSObject, eventName: String, force: Boolean) {
        val androidId = entry.getLong("androidId")
        val hash = entry.getString("hash", "") ?: ""
        if (hash.isBlank()) return

        val isNewHash = seenHashes.add(hash)
        val isTracked = trackedAndroidIds.contains(androidId)
        if (!isNewHash && !force && !isTracked) return

        rememberEntry(entry)

        if (androidId > lastProcessedId.get()) {
            lastProcessedId.set(androidId)
        }

        handler.post {
            plugin.emit(eventName, entry)
        }
    }

    private fun rememberEntry(entry: JSObject) {
        val androidId = entry.getLong("androidId")
        val hash = entry.getString("hash", "") ?: ""
        trackedAndroidIds.add(androidId)
        trackedEntries[androidId] = entry
        if (hash.isNotBlank()) {
            seenHashes.add(hash)
        }
        snapshotByAndroidId[androidId] = entrySnapshot(entry)
        NativeCallCache.mergeFromJsObjects(plugin.context, listOf(entry))
    }

    private fun entrySnapshot(entry: JSObject): String {
        return listOf(
            entry.getString("contactName", "") ?: "",
            entry.getLong("duration").toString(),
            entry.getString("phoneNumber", "") ?: "",
            entry.getString("callType", "") ?: ""
        ).joinToString("|")
    }

    private fun detectDeletions() {
        val idsToCheck = trackedAndroidIds.toList()
        if (idsToCheck.isEmpty()) return

        val existingIds = mutableSetOf<Long>()
        idsToCheck.chunked(100).forEach { chunk ->
            val placeholders = chunk.joinToString(",") { "?" }
            bridge.activity?.contentResolver?.query(
                CallLog.Calls.CONTENT_URI,
                arrayOf(CallLog.Calls._ID),
                "${CallLog.Calls._ID} IN ($placeholders)",
                chunk.map { it.toString() }.toTypedArray(),
                null
            )?.use { cursor ->
                while (cursor.moveToNext()) {
                    existingIds.add(cursor.getLong(0))
                }
            }
        }

        val deletedIds = idsToCheck.filter { it !in existingIds }
        deletedIds.forEach { deletedId ->
            trackedAndroidIds.remove(deletedId)
            snapshotByAndroidId.remove(deletedId)

            val cachedEntry = trackedEntries.remove(deletedId)
            val hash = cachedEntry?.getString("hash", "")
                ?: ""

            val payload = JSObject().apply {
                put("androidId", deletedId)
                put("hash", hash)
                put("deviceId", deviceId)
                if (cachedEntry != null) {
                    put("call", cachedEntry)
                }
            }
            handler.post {
                plugin.emit("callDeleted", payload)
            }
            Log.d(TAG, "Call deleted from device: androidId=$deletedId hash=$hash cached=${cachedEntry != null}")
        }
    }
}
