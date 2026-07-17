package com.enterprisecalllog.plugin

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

/**
 * CallLogSyncPlugin — Production Android Native Implementation
 *
 * Bridges Ionic ↔ Android for call log read, real-time detection,
 * and background sync scheduling.
 */
@CapacitorPlugin(
    name = "CallLogSync",
    permissions = [
        Permission(
            strings = [Manifest.permission.READ_CALL_LOG],
            alias = "readCallLog"
        ),
        Permission(
            strings = [Manifest.permission.READ_PHONE_STATE],
            alias = "readPhoneState"
        ),
        Permission(
            strings = [Manifest.permission.READ_CONTACTS],
            alias = "readContacts"
        ),
        Permission(
            strings = [Manifest.permission.POST_NOTIFICATIONS],
            alias = "postNotifications"
        )
    ]
)
class CallLogSyncPlugin : Plugin() {

    private var changeDetector: CallLogChangeDetector? = null
    private var contactNameResolver: ContactNameResolver? = null
    private var syncBroadcastReceiver: BroadcastReceiver? = null

    override fun load() {
        super.load()
        contactNameResolver = ContactNameResolver(context)
        registerSyncBroadcastReceiver()
        CallLogSyncWorker.schedule(context)
    }

    @PluginMethod
    fun echo(call: PluginCall) {
        val value = call.getString("value", "") ?: ""
        if (value.isEmpty()) {
            call.reject("Value is required", "INVALID_ARGUMENT")
            return
        }
        val result = JSObject()
        result.put("value", value)
        call.resolve(result)
    }

    @PluginMethod
    override fun checkPermissions(call: PluginCall) {
        val result = JSObject()
        result.put("readCallLog", isPermissionGranted(Manifest.permission.READ_CALL_LOG))
        result.put("readPhoneState", isPermissionGranted(Manifest.permission.READ_PHONE_STATE))
        result.put("readContacts", isPermissionGranted(Manifest.permission.READ_CONTACTS))
        result.put("postNotifications", hasPostNotificationPermission())
        call.resolve(result)
    }

  @PluginMethod
  override fun requestPermissions(call: PluginCall) {
    val alias = when {
      !isPermissionGranted(Manifest.permission.READ_CALL_LOG) -> "readCallLog"
      !isPermissionGranted(Manifest.permission.READ_PHONE_STATE) -> "readPhoneState"
      !isPermissionGranted(Manifest.permission.READ_CONTACTS) -> "readContacts"
      else -> null
    }

        if (alias == null) {
            checkPermissions(call)
            return
        }

        requestPermissionForAlias(alias, call, "permissionsCallback")
    }

    @PermissionCallback
    private fun permissionsCallback(call: PluginCall) {
        if (!isPermissionGranted(Manifest.permission.READ_CALL_LOG)) {
            requestPermissionForAlias("readCallLog", call, "permissionsCallback")
            return
        }
        if (!isPermissionGranted(Manifest.permission.READ_PHONE_STATE)) {
            requestPermissionForAlias("readPhoneState", call, "permissionsCallback")
            return
        }
        if (!isPermissionGranted(Manifest.permission.READ_CONTACTS)) {
            requestPermissionForAlias("readContacts", call, "permissionsCallback")
            return
        }
        checkPermissions(call)
    }

    @PluginMethod
    fun readCallLog(call: PluginCall) {
        if (!isPermissionGranted(Manifest.permission.READ_CALL_LOG)) {
            call.reject("READ_CALL_LOG permission not granted", "PERMISSION_DENIED")
            return
        }

        val limit = call.getInt("limit", 50) ?: 50
        val offset = call.getInt("offset", 0) ?: 0
        val since = call.getLong("since", 0L) ?: 0L

        Thread {
            try {
                val reader = createReader()
                val readResult = reader.read(
                    limit = limit,
                    offset = offset,
                    since = if (since > 0) since else null
                )

                val result = JSObject()
                result.put("calls", readResult.calls)
                result.put("total", readResult.total)
                result.put("hasMore", readResult.hasMore)
                call.resolve(result)
            } catch (e: Exception) {
                call.reject("Failed to read call log: ${e.message}", "READ_ERROR", e)
            }
        }.start()
    }

    @PluginMethod
    fun startObserver(call: PluginCall) {
        if (!isPermissionGranted(Manifest.permission.READ_CALL_LOG)) {
            call.reject("READ_CALL_LOG permission not granted", "PERMISSION_DENIED")
            return
        }

        val includeExisting = call.getBoolean("includeExisting", false) ?: false

        if (changeDetector?.isActive() == true) {
            val result = JSObject()
            result.put("started", true)
            call.resolve(result)
            return
        }

        val reader = createReader()
        changeDetector = CallLogChangeDetector(
            plugin = this,
            bridge = bridge,
            callLogReader = reader,
            contactNameResolver = if (isPermissionGranted(Manifest.permission.READ_CONTACTS)) {
                contactNameResolver
            } else {
                null
            },
            deviceId = getStableDeviceId()
        )
        changeDetector?.start(includeExisting = includeExisting)

        val result = JSObject()
        result.put("started", true)
        call.resolve(result)
    }

    @PluginMethod
    fun stopObserver(call: PluginCall) {
        changeDetector?.stop()
        changeDetector = null

        val result = JSObject()
        result.put("stopped", true)
        call.resolve(result)
    }

    @PluginMethod
    fun getDeviceId(call: PluginCall) {
        val result = JSObject()
        result.put("deviceId", getStableDeviceId())
        call.resolve(result)
    }

    @PluginMethod
    fun getPluginStatus(call: PluginCall) {
        val bgPrefs = context.getSharedPreferences("call_log_bg_sync", Context.MODE_PRIVATE)
        val result = JSObject()
        result.put("observerActive", changeDetector?.isActive() == true)
        result.put("contactsObserverActive", changeDetector?.isContactsObserverActive() == true)
        result.put("backgroundSyncConfigured", NativeBackgroundSync.isConfigured(context))
        result.put("backgroundSyncPending", CallLogSyncWorker.isSyncRequested(context))
        result.put("trackedCallsCount", changeDetector?.getTrackedCount() ?: 0)
        result.put("lastNativeSyncAt", bgPrefs.getLong("last_native_sync_at", 0L))
        result.put("deviceId", getStableDeviceId())

        val perms = JSObject()
        perms.put("readCallLog", isPermissionGranted(Manifest.permission.READ_CALL_LOG))
        perms.put("readPhoneState", isPermissionGranted(Manifest.permission.READ_PHONE_STATE))
        perms.put("readContacts", isPermissionGranted(Manifest.permission.READ_CONTACTS))
        perms.put("postNotifications", hasPostNotificationPermission())
        result.put("permissions", perms)

        call.resolve(result)
    }

    @PluginMethod
    fun getNetworkInfo(call: PluginCall) {
        call.resolve(NetworkInfoHelper.read(context))
    }

    /**
     * Returns cached calls that were already uploaded but removed from the phone dialer.
     */
    @PluginMethod
    fun getCachedDeletionsFromPhone(call: PluginCall) {
        if (!isPermissionGranted(Manifest.permission.READ_CALL_LOG)) {
            call.reject("READ_CALL_LOG permission not granted", "PERMISSION_DENIED")
            return
        }

        Thread {
            try {
                val reader = createReader()
                val removed = NativeCallCache.getCachedRemovedFromPhone(context, reader)
                val result = JSObject()
                result.put("calls", removed)
                result.put("count", removed.size)
                call.resolve(result)
            } catch (e: Exception) {
                call.reject("Failed to read cached deletions: ${e.message}", "READ_ERROR", e)
            }
        }.start()
    }

    @PluginMethod
    fun clearCachedDeletions(call: PluginCall) {
        val androidIds = call.getArray("androidIds") ?: run {
            call.reject("androidIds array is required", "INVALID_ARGUMENT")
            return
        }

        val ids = mutableListOf<Long>()
        for (i in 0 until androidIds.length()) {
            val value = androidIds.opt(i)
            when (value) {
                is Number -> ids.add(value.toLong())
                is String -> value.toLongOrNull()?.let { ids.add(it) }
            }
        }

        NativeCallCache.removeEntries(context, ids)
        val result = JSObject()
        result.put("cleared", ids.size)
        call.resolve(result)
    }

    @PluginMethod
    fun scheduleBackgroundSync(call: PluginCall) {
        CallLogSyncWorker.schedule(context)
        val result = JSObject()
        result.put("scheduled", true)
        call.resolve(result)
    }

    @PluginMethod
    fun cancelBackgroundSync(call: PluginCall) {
        CallLogSyncWorker.cancel(context)
        val result = JSObject()
        result.put("cancelled", true)
        call.resolve(result)
    }

    @PluginMethod
    fun isBackgroundSyncPending(call: PluginCall) {
        val result = JSObject()
        result.put("pending", CallLogSyncWorker.isSyncRequested(context))
        call.resolve(result)
    }

    @PluginMethod
    fun clearBackgroundSyncPending(call: PluginCall) {
        CallLogSyncWorker.clearSyncRequested(context)
        val result = JSObject()
        result.put("cleared", true)
        call.resolve(result)
    }

    /**
     * Configure silent background sync credentials.
     * WorkManager uses these to sync directly to API without any notification.
     */
    @PluginMethod
    fun configureBackgroundSync(call: PluginCall) {
        val apiUrl = call.getString("apiUrl", "") ?: ""
        val token = call.getString("token", "") ?: ""
        val apiKey = call.getString("apiKey", "") ?: ""
        val deviceId = call.getString("deviceId", "") ?: ""

        if (apiUrl.isEmpty() || token.isEmpty() || apiKey.isEmpty() || deviceId.isEmpty()) {
            call.reject("apiUrl, token, apiKey, and deviceId are required", "INVALID_ARGUMENT")
            return
        }

        NativeBackgroundSync.saveConfig(context, apiUrl, token, apiKey, deviceId)
        CallLogSyncWorker.schedule(context)
        CallLogSyncWorker.scheduleImmediate(context)

        val result = JSObject()
        result.put("configured", true)
        call.resolve(result)
    }

    fun emit(eventName: String, data: JSObject) {
        notifyListeners(eventName, data)
    }

    override fun handleOnDestroy() {
        changeDetector?.stop()
        changeDetector = null
        unregisterSyncBroadcastReceiver()
        super.handleOnDestroy()
    }

    private fun createReader(): CallLogReader {
        return CallLogReader(
            context = context,
            deviceId = getStableDeviceId(),
            contactNameResolver = if (isPermissionGranted(Manifest.permission.READ_CONTACTS)) {
                contactNameResolver
            } else {
                null
            }
        )
    }

    private fun getStableDeviceId(): String {
        return Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ANDROID_ID
        ) ?: "unknown"
    }

    private fun isPermissionGranted(permission: String): Boolean {
        return ContextCompat.checkSelfPermission(context, permission) ==
            PackageManager.PERMISSION_GRANTED
    }

    private fun hasPostNotificationPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            isPermissionGranted(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            true
        }
    }

    private fun registerSyncBroadcastReceiver() {
        if (syncBroadcastReceiver != null) return

        syncBroadcastReceiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context?, intent: Intent?) {
                if (intent?.action == CallLogSyncWorker.ACTION_SYNC_REQUESTED) {
                    val payload = JSObject()
                    payload.put("trigger", "workmanager")
                    payload.put("timestamp", System.currentTimeMillis())
                    notifyListeners("backgroundSync", payload)
                }
            }
        }

        val filter = IntentFilter(CallLogSyncWorker.ACTION_SYNC_REQUESTED)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(syncBroadcastReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            context.registerReceiver(syncBroadcastReceiver, filter)
        }
    }

    private fun unregisterSyncBroadcastReceiver() {
        syncBroadcastReceiver?.let {
            try {
                context.unregisterReceiver(it)
            } catch (_: Exception) {
                // Receiver may already be unregistered
            }
        }
        syncBroadcastReceiver = null
    }
}
