package com.enterprisecalllog.plugin

import android.content.Context
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

/**
 * Silent background sync — NO notification, NO foreground service.
 *
 * Uses a persistent [NativeCallCache] so calls deleted from the phone
 * before upload still reach the server. Triggered by WorkManager and
 * [PhoneStateReceiver] when calls end.
 */
object NativeBackgroundSync {

    private const val TAG = "NativeBackgroundSync"
    private const val PREFS_NAME = "call_log_bg_sync"
    private const val MAX_BATCHES_PER_RUN = 5

    fun saveConfig(
        context: Context,
        apiUrl: String,
        token: String,
        apiKey: String,
        deviceId: String
    ) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString("api_url", apiUrl)
            .putString("token", token)
            .putString("api_key", apiKey)
            .putString("device_id", deviceId)
            .apply()
    }

    fun isConfigured(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return !prefs.getString("api_url", null).isNullOrBlank() &&
            !prefs.getString("token", null).isNullOrBlank() &&
            !prefs.getString("api_key", null).isNullOrBlank()
    }

    /** Read phone call log into persistent cache — no network required. */
    fun captureCalls(context: Context): Int {
        if (!isConfigured(context)) {
            Log.d(TAG, "Background sync not configured — skip capture")
            return 0
        }

        return try {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val deviceId = prefs.getString("device_id", "") ?: ""
            if (deviceId.isBlank()) return 0

            val reader = CallLogReader(context, deviceId, null)
            val count = NativeCallCache.mergeFromPhone(context, reader)
            Log.d(TAG, "Captured $count calls into native cache")
            count
        } catch (e: Exception) {
            Log.e(TAG, "Call capture failed", e)
            0
        }
    }

    fun perform(context: Context): Boolean {
        if (!isConfigured(context)) {
            Log.d(TAG, "Background sync not configured — skipping")
            return true
        }

        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val apiUrl = prefs.getString("api_url", "")!!
        val token = prefs.getString("token", "")!!
        val apiKey = prefs.getString("api_key", "")!!
        val deviceId = prefs.getString("device_id", "")!!

        return try {
            captureCalls(context)

            val reader = CallLogReader(context, deviceId, null)
            var allSuccess = true
            var uploadedTotal = 0
            var deletedTotal = 0

            repeat(MAX_BATCHES_PER_RUN) {
                val unsyncedRemoved = NativeCallCache.getUnsyncedRemovedFromPhone(context, reader)
                if (unsyncedRemoved.isEmpty()) return@repeat

                val payload = buildPayload(deviceId, unsyncedRemoved, unsyncedRemoved)
                var success = postBatchSync("$apiUrl/call-log/batch-sync", token, apiKey, payload)

                if (!success && isInvalidApiKey()) {
                    Log.w(TAG, "Invalid API key — re-registering device")
                    if (refreshCredentials(context, prefs, apiUrl, deviceId)) {
                        val newToken = prefs.getString("token", "")!!
                        val newApiKey = prefs.getString("api_key", "")!!
                        success = postBatchSync("$apiUrl/call-log/batch-sync", newToken, newApiKey, payload)
                    }
                }

                if (success) {
                    val hashes = unsyncedRemoved.mapNotNull { it.getString("hash", "")?.ifBlank { null } }
                    val androidIds = unsyncedRemoved.map { it.getLong("androidId") }
                    NativeCallCache.markSynced(context, hashes)
                    NativeCallCache.removeEntries(context, androidIds)
                    uploadedTotal += unsyncedRemoved.size
                    deletedTotal += unsyncedRemoved.size
                    Log.d(TAG, "Synced ${unsyncedRemoved.size} offline deleted call(s)")
                } else {
                    allSuccess = false
                    return@repeat
                }
            }

            repeat(MAX_BATCHES_PER_RUN) {
                val removed = NativeCallCache.getSyncedRemovedFromPhone(context, reader)
                if (removed.isEmpty()) return@repeat

                val deletedIds = removed.map { it.getLong("androidId") }
                val payload = buildPayload(deviceId, emptyList(), removed)
                var success = postBatchSync("$apiUrl/call-log/batch-sync", token, apiKey, payload)

                if (!success && isInvalidApiKey()) {
                    Log.w(TAG, "Invalid API key — re-registering device")
                    if (refreshCredentials(context, prefs, apiUrl, deviceId)) {
                        val newToken = prefs.getString("token", "")!!
                        val newApiKey = prefs.getString("api_key", "")!!
                        success = postBatchSync("$apiUrl/call-log/batch-sync", newToken, newApiKey, payload)
                    }
                }

                if (success) {
                    NativeCallCache.removeEntries(context, deletedIds)
                    deletedTotal += deletedIds.size
                    Log.d(TAG, "Synced ${deletedIds.size} deletions from phone")
                } else {
                    allSuccess = false
                    return@repeat
                }
            }

            repeat(MAX_BATCHES_PER_RUN) {
                val batch = NativeCallCache.getUnsynced(context, 50)
                if (batch.isEmpty()) return@repeat

                val payload = buildPayload(deviceId, batch, emptyList())
                var success = postBatchSync("$apiUrl/call-log/batch-sync", token, apiKey, payload)

                if (!success && isInvalidApiKey()) {
                    Log.w(TAG, "Invalid API key — re-registering device")
                    if (refreshCredentials(context, prefs, apiUrl, deviceId)) {
                        val newToken = prefs.getString("token", "")!!
                        val newApiKey = prefs.getString("api_key", "")!!
                        success = postBatchSync("$apiUrl/call-log/batch-sync", newToken, newApiKey, payload)
                    }
                }

                if (success) {
                    val hashes = batch.mapNotNull { it.getString("hash", "")?.ifBlank { null } }
                    NativeCallCache.markSynced(context, hashes)
                    uploadedTotal += batch.size
                } else {
                    allSuccess = false
                    return@repeat
                }
            }

            if (uploadedTotal > 0 || deletedTotal > 0) {
                prefs.edit().putLong("last_native_sync_at", System.currentTimeMillis()).apply()
                Log.d(TAG, "Silent sync: uploaded $uploadedTotal calls, $deletedTotal deletions")
            } else {
                Log.d(TAG, "No pending calls or deletions to sync")
            }

            allSuccess
        } catch (e: Exception) {
            Log.e(TAG, "Silent background sync failed", e)
            false
        }
    }

    private fun buildPayload(
        deviceId: String,
        calls: List<com.getcapacitor.JSObject>,
        deletions: List<com.getcapacitor.JSObject>
    ): String {
        val root = JSONObject()
        root.put("deviceId", deviceId)

        val callsArray = JSONArray()
        for (call in calls) {
            val obj = JSONObject()
            obj.put("hash", call.getString("hash", ""))
            obj.put("androidId", call.getLong("androidId"))
            obj.put("phoneNumber", call.getString("phoneNumber", ""))
            obj.put("contactName", call.getString("contactName", ""))
            obj.put("callType", call.getString("callType", "UNKNOWN"))
            obj.put("duration", call.getLong("duration"))
            obj.put("callTime", call.getLong("callTime"))
            obj.put("simSlot", call.getInteger("simSlot", -1))
            callsArray.put(obj)
        }
        root.put("calls", callsArray)

        val deletionsArray = JSONArray()
        for (del in deletions) {
            val obj = JSONObject()
            obj.put("androidId", del.getLong("androidId"))
            val hash = del.getString("hash", "")
            if (!hash.isNullOrBlank()) {
                obj.put("hash", hash)
            }
            deletionsArray.put(obj)
        }
        root.put("deletions", deletionsArray)

        return root.toString()
    }

    private fun postBatchSync(
        urlString: String,
        token: String,
        apiKey: String,
        jsonBody: String
    ): Boolean {
        val url = URL(urlString)
        val conn = url.openConnection() as HttpURLConnection

        return try {
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("Authorization", "Bearer $token")
            conn.setRequestProperty("X-API-Key", apiKey)
            conn.setRequestProperty("ngrok-skip-browser-warning", "true")
            conn.connectTimeout = 15_000
            conn.readTimeout = 30_000
            conn.doOutput = true

            OutputStreamWriter(conn.outputStream).use { it.write(jsonBody) }

            val code = conn.responseCode
            if (code in 200..299) {
                true
            } else {
                val error = BufferedReader(InputStreamReader(conn.errorStream ?: conn.inputStream))
                    .use { it.readText() }
                Log.w(TAG, "API returned $code: $error")
                if (code == 403 && error.contains("Invalid or inactive device API key")) {
                    lastAuthError = error
                }
                false
            }
        } finally {
            conn.disconnect()
        }
    }

    private var lastAuthError: String? = null

    private fun isInvalidApiKey(): Boolean {
        return lastAuthError?.contains("Invalid or inactive device API key") == true
    }

    private fun refreshCredentials(
        context: Context,
        prefs: android.content.SharedPreferences,
        apiUrl: String,
        deviceId: String
    ): Boolean {
        val deviceName = android.os.Build.MODEL.ifBlank { "Android Device" }
        val registerUrl = "$apiUrl/auth/register-device"
        val body = JSONObject()
            .put("deviceId", deviceId)
            .put("deviceName", deviceName)
            .toString()

        val url = URL(registerUrl)
        val conn = url.openConnection() as HttpURLConnection

        return try {
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("ngrok-skip-browser-warning", "true")
            conn.connectTimeout = 15_000
            conn.readTimeout = 30_000
            conn.doOutput = true

            OutputStreamWriter(conn.outputStream).use { it.write(body) }

            if (conn.responseCode !in 200..299) {
                val error = BufferedReader(InputStreamReader(conn.errorStream ?: conn.inputStream))
                    .use { it.readText() }
                Log.w(TAG, "Re-register failed ${conn.responseCode}: $error")
                return false
            }

            val responseText = BufferedReader(InputStreamReader(conn.inputStream))
                .use { it.readText() }
            val json = JSONObject(responseText)
            val token = json.getString("token")
            val apiKey = json.getString("apiKey")

            prefs.edit()
                .putString("token", token)
                .putString("api_key", apiKey)
                .putString("device_id", deviceId)
                .apply()

            lastAuthError = null
            Log.i(TAG, "Device re-registered successfully")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Re-register exception", e)
            false
        } finally {
            conn.disconnect()
        }
    }
}
