package com.enterprisecalllog.plugin

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager

/**
 * Reschedules silent background sync after device reboot.
 * No notification shown.
 */
class BootCompletedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action == Intent.ACTION_BOOT_COMPLETED ||
            intent?.action == Intent.ACTION_MY_PACKAGE_REPLACED
        ) {
            CallLogSyncWorker.schedule(context)

            val immediate = OneTimeWorkRequestBuilder<CallLogSyncWorker>().build()
            WorkManager.getInstance(context).enqueue(immediate)
        }
    }
}
