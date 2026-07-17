package com.enterprisecalllog.plugin

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telephony.TelephonyManager
import android.util.Log

/**
 * Triggers immediate call capture + sync when a phone call ends.
 * Works while the app process is dead (manifest-registered receiver).
 */
class PhoneStateReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != TelephonyManager.ACTION_PHONE_STATE_CHANGED) return

        val state = intent.getStringExtra(TelephonyManager.EXTRA_STATE) ?: return
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val previous = prefs.getString(KEY_LAST_STATE, null)

        val callEnded = state == TelephonyManager.EXTRA_STATE_IDLE &&
            (previous == TelephonyManager.EXTRA_STATE_OFFHOOK ||
                previous == TelephonyManager.EXTRA_STATE_RINGING)

        prefs.edit().putString(KEY_LAST_STATE, state).apply()

        if (!callEnded) return

        Log.d(TAG, "Call ended — capturing call log and scheduling background sync")

        val pendingResult = goAsync()
        Thread {
            try {
                NativeBackgroundSync.captureCalls(context)
                CallLogSyncWorker.scheduleAfterCallEnd(context)
            } catch (e: Exception) {
                Log.e(TAG, "Post-call sync trigger failed", e)
            } finally {
                pendingResult.finish()
            }
        }.start()
    }

    companion object {
        private const val TAG = "PhoneStateReceiver"
        private const val PREFS = "phone_state_receiver"
        private const val KEY_LAST_STATE = "last_phone_state"
    }
}
