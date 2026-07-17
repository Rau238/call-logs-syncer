package com.enterprisecalllog.plugin

import android.content.Context
import android.content.Intent
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

/**
 * Silent WorkManager worker — NO notification, NO foreground service.
 *
 * Real-time path: ContentObserver when app process is alive.
 * Background path: chained one-time sync every ~60s when internet available.
 * Periodic 15min work kept as backup.
 */
class CallLogSyncWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val nativeOk = NativeBackgroundSync.perform(applicationContext)

        val prefs = applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit()
            .putBoolean(KEY_SYNC_REQUESTED, true)
            .putLong(KEY_SYNC_REQUESTED_AT, System.currentTimeMillis())
            .apply()

        val intent = Intent(ACTION_SYNC_REQUESTED).apply {
            setPackage(applicationContext.packageName)
        }
        applicationContext.sendBroadcast(intent)

        scheduleFastChain(applicationContext)

        return if (nativeOk) Result.success() else Result.retry()
    }

    companion object {
        const val WORK_NAME = "call_log_periodic_sync"
        const val FAST_WORK_NAME = "call_log_fast_sync"
        const val PREFS_NAME = "call_log_sync_worker"
        const val KEY_SYNC_REQUESTED = "sync_requested"
        const val KEY_SYNC_REQUESTED_AT = "sync_requested_at"
        const val ACTION_SYNC_REQUESTED = "com.enterprisecalllog.plugin.SYNC_REQUESTED"
        private const val FAST_SYNC_DELAY_SECONDS = 30L

        private fun buildConstraints(): Constraints {
            return Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
        }

        fun schedule(context: Context) {
            val periodic = PeriodicWorkRequestBuilder<CallLogSyncWorker>(
                15, TimeUnit.MINUTES
            )
                .setConstraints(buildConstraints())
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                periodic
            )

            scheduleFastChain(context)
        }

        /** Chain fast sync every ~30s when app is killed (requires network). */
        fun scheduleFastChain(context: Context) {
            val request = OneTimeWorkRequestBuilder<CallLogSyncWorker>()
                .setInitialDelay(FAST_SYNC_DELAY_SECONDS, TimeUnit.SECONDS)
                .setConstraints(buildConstraints())
                .build()

            WorkManager.getInstance(context).enqueueUniqueWork(
                FAST_WORK_NAME,
                ExistingWorkPolicy.REPLACE,
                request
            )
        }

        fun scheduleImmediate(context: Context) {
            val request = OneTimeWorkRequestBuilder<CallLogSyncWorker>()
                .setConstraints(buildConstraints())
                .build()
            WorkManager.getInstance(context).enqueue(request)
        }

        /** After a call ends, retry sync while Android writes the call log row. */
        fun scheduleAfterCallEnd(context: Context) {
            scheduleImmediate(context)
            listOf(3L, 10L, 30L, 60L).forEach { delaySeconds ->
                val request = OneTimeWorkRequestBuilder<CallLogSyncWorker>()
                    .setInitialDelay(delaySeconds, TimeUnit.SECONDS)
                    .setConstraints(buildConstraints())
                    .build()
                WorkManager.getInstance(context).enqueueUniqueWork(
                    "call_log_post_call_${delaySeconds}s",
                    ExistingWorkPolicy.REPLACE,
                    request
                )
            }
        }

        fun cancel(context: Context) {
            val wm = WorkManager.getInstance(context)
            wm.cancelUniqueWork(WORK_NAME)
            wm.cancelUniqueWork(FAST_WORK_NAME)
        }

        fun isSyncRequested(context: Context): Boolean {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            return prefs.getBoolean(KEY_SYNC_REQUESTED, false)
        }

        fun clearSyncRequested(context: Context) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putBoolean(KEY_SYNC_REQUESTED, false).apply()
        }
    }
}
