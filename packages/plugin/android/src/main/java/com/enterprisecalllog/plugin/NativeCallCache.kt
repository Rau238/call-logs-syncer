package com.enterprisecalllog.plugin

import android.content.Context
import android.util.Log
import com.getcapacitor.JSObject
import org.json.JSONArray
import org.json.JSONObject

/**
 * Persistent call cache — survives app kill and call-log deletion on device.
 *
 * Background sync merges phone reads into this cache, then uploads any entry
 * whose hash is not yet in [synced_hashes]. Deleted-from-phone calls remain
 * uploadable as long as they were cached before deletion.
 */
object NativeCallCache {

    private const val TAG = "NativeCallCache"
    private const val PREFS = "call_log_native_cache"
    private const val KEY_ENTRIES = "entries_v1"
    private const val KEY_SYNCED_HASHES = "synced_hashes_v1"

    fun mergeFromJsObjects(context: Context, calls: List<JSObject>) {
        if (calls.isEmpty()) return
        val map = loadMap(context)
        for (call in calls) {
            val androidId = call.getLong("androidId")
            if (androidId <= 0) continue
            map[androidId] = jsObjectToJson(call)
        }
        pruneAndSave(context, map)
    }

    fun mergeFromPhone(context: Context, reader: CallLogReader): Int {
        val since = SyncConfig.syncWindowStartMs()
        val onPhone = reader.read(limit = 500, offset = 0, since = since).calls
        mergeFromJsObjects(context, onPhone)
        return onPhone.size
    }

    fun getUnsynced(context: Context, limit: Int = 50): List<JSObject> {
        val since = SyncConfig.syncWindowStartMs()
        val synced = getSyncedHashes(context)
        return loadMap(context).values
            .asSequence()
            .filter { it.optLong("callTime") >= since }
            .filter {
                val hash = it.optString("hash", "")
                hash.isNotBlank() && hash !in synced
            }
            .sortedByDescending { it.optLong("callTime") }
            .take(limit)
            .map { jsonToJsObject(it) }
            .toList()
    }

    fun markSynced(context: Context, hashes: Collection<String>) {
        if (hashes.isEmpty()) return
        val synced = getSyncedHashes(context).toMutableSet()
        synced.addAll(hashes.filter { it.isNotBlank() })
        saveSyncedHashes(context, synced)
    }

    /**
     * Cached calls (synced or not) that are no longer on the phone dialer.
     */
    fun getCachedRemovedFromPhone(context: Context, reader: CallLogReader): List<JSObject> {
        val since = SyncConfig.syncWindowStartMs()
        val onPhone = reader.read(limit = 500, offset = 0, since = since).calls
            .map { it.getLong("androidId") }
            .toSet()

        return loadMap(context).values
            .asSequence()
            .filter { it.optLong("callTime") >= since }
            .filter { it.optLong("androidId") !in onPhone }
            .sortedByDescending { it.optLong("callTime") }
            .map { jsonToJsObject(it) }
            .toList()
    }

    /** Previously uploaded calls removed from the phone — deletion-only sync. */
    fun getSyncedRemovedFromPhone(context: Context, reader: CallLogReader): List<JSObject> {
        val since = SyncConfig.syncWindowStartMs()
        val onPhone = reader.read(limit = 500, offset = 0, since = since).calls
            .map { it.getLong("androidId") }
            .toSet()
        val synced = getSyncedHashes(context)

        return loadMap(context).values
            .asSequence()
            .filter { it.optLong("callTime") >= since }
            .filter {
                val hash = it.optString("hash", "")
                hash.isNotBlank() && hash in synced
            }
            .filter { it.optLong("androidId") !in onPhone }
            .sortedByDescending { it.optLong("callTime") }
            .map { jsonToJsObject(it) }
            .toList()
    }

    /**
     * Cached calls never uploaded that were removed from the phone while offline.
     * Requires insert + delete in the same batch.
     */
    fun getUnsyncedRemovedFromPhone(context: Context, reader: CallLogReader): List<JSObject> {
        val synced = getSyncedHashes(context)
        return getCachedRemovedFromPhone(context, reader).filter {
            val hash = it.getString("hash", "") ?: ""
            hash.isBlank() || hash !in synced
        }
    }

    fun removeEntries(context: Context, androidIds: Collection<Long>) {
        if (androidIds.isEmpty()) return
        val map = loadMap(context)
        var changed = false
        for (id in androidIds) {
            if (map.remove(id) != null) changed = true
        }
        if (changed) pruneAndSave(context, map)
    }

    fun cachedCount(context: Context): Int = loadMap(context).size

    private fun loadMap(context: Context): MutableMap<Long, JSONObject> {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val raw = prefs.getString(KEY_ENTRIES, "[]") ?: "[]"
        val map = mutableMapOf<Long, JSONObject>()
        try {
            val array = JSONArray(raw)
            for (i in 0 until array.length()) {
                val obj = array.optJSONObject(i) ?: continue
                val id = obj.optLong("androidId")
                if (id > 0) map[id] = obj
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to parse cache — resetting", e)
        }
        return map
    }

    private fun pruneAndSave(context: Context, map: MutableMap<Long, JSONObject>) {
        val since = SyncConfig.syncWindowStartMs()
        map.entries.removeIf { it.value.optLong("callTime") < since }

        val synced = getSyncedHashes(context).toMutableSet()
        val validHashes = map.values.mapNotNull { it.optString("hash", "").ifBlank { null } }.toSet()
        synced.retainAll(validHashes)
        saveSyncedHashes(context, synced)

        val array = JSONArray()
        map.values.sortedByDescending { it.optLong("callTime") }.forEach { array.put(it) }

        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_ENTRIES, array.toString())
            .apply()
    }

    private fun getSyncedHashes(context: Context): Set<String> {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_SYNCED_HASHES, "") ?: ""
        if (raw.isBlank()) return emptySet()
        return raw.split(",").map { it.trim() }.filter { it.isNotEmpty() }.toSet()
    }

    private fun saveSyncedHashes(context: Context, hashes: Set<String>) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_SYNCED_HASHES, hashes.joinToString(","))
            .apply()
    }

    private fun jsObjectToJson(obj: JSObject): JSONObject {
        return JSONObject().apply {
            put("androidId", obj.getLong("androidId"))
            put("hash", obj.getString("hash", ""))
            put("phoneNumber", obj.getString("phoneNumber", ""))
            put("contactName", obj.getString("contactName", ""))
            put("callType", obj.getString("callType", "UNKNOWN"))
            put("duration", obj.getLong("duration"))
            put("callTime", obj.getLong("callTime"))
            put("simSlot", obj.getInteger("simSlot", -1))
        }
    }

    private fun jsonToJsObject(json: JSONObject): JSObject {
        return JSObject().apply {
            put("androidId", json.optLong("androidId"))
            put("hash", json.optString("hash", ""))
            put("phoneNumber", json.optString("phoneNumber", ""))
            put("contactName", json.optString("contactName", ""))
            put("callType", json.optString("callType", "UNKNOWN"))
            put("duration", json.optLong("duration"))
            put("callTime", json.optLong("callTime"))
            put("simSlot", json.optInt("simSlot", -1))
        }
    }
}
