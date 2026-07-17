package com.enterprisecalllog.plugin

/**
 * Shared sync policy — keep in sync with apps/mobile syncWindowDays (7).
 */
object SyncConfig {
    const val SYNC_WINDOW_DAYS = 7L
    const val SYNC_WINDOW_MS = SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000

    fun syncWindowStartMs(now: Long = System.currentTimeMillis()): Long {
        return now - SYNC_WINDOW_MS
    }
}
