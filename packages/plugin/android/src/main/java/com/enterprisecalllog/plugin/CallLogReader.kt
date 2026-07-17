package com.enterprisecalllog.plugin

import android.content.Context
import android.provider.CallLog
import com.getcapacitor.JSObject

/**
 * Reads call log entries from Android's CallLog ContentProvider.
 * Supports pagination and filtering by timestamp.
 */
class CallLogReader(
    private val context: Context,
    private val deviceId: String,
    private val contactNameResolver: ContactNameResolver?
) {

    data class ReadResult(
        val calls: List<JSObject>,
        val total: Int,
        val hasMore: Boolean
    )

    fun read(limit: Int = 50, offset: Int = 0, since: Long? = null): ReadResult {
        val safeLimit = limit.coerceIn(1, 500)
        val safeOffset = offset.coerceAtLeast(0)

        val selection = StringBuilder()
        val selectionArgs = mutableListOf<String>()

        if (since != null && since > 0) {
            selection.append("${CallLog.Calls.DATE} >= ?")
            selectionArgs.add(since.toString())
        }

        val orderBy = "${CallLog.Calls.DATE} DESC"
        val projection = CallLogMapper.getProjection()

        val allCalls = mutableListOf<JSObject>()
        context.contentResolver.query(
            CallLog.Calls.CONTENT_URI,
            projection,
            if (selection.isNotEmpty()) selection.toString() else null,
            if (selectionArgs.isNotEmpty()) selectionArgs.toTypedArray() else null,
            orderBy
        )?.use { cursor ->
            while (cursor.moveToNext()) {
                CallLogMapper.cursorToJSObject(cursor, deviceId, contactNameResolver)
                    ?.let { allCalls.add(it) }
            }
        }

        val total = allCalls.size
        val page = allCalls.drop(safeOffset).take(safeLimit)
        val hasMore = safeOffset + page.size < total

        return ReadResult(calls = page, total = total, hasMore = hasMore)
    }

    fun readByAndroidId(androidId: Long): JSObject? {
        val projection = CallLogMapper.getProjection()
        context.contentResolver.query(
            CallLog.Calls.CONTENT_URI,
            projection,
            "${CallLog.Calls._ID} = ?",
            arrayOf(androidId.toString()),
            null
        )?.use { cursor ->
            if (cursor.moveToFirst()) {
                return CallLogMapper.cursorToJSObject(cursor, deviceId, contactNameResolver)
            }
        }
        return null
    }

    fun readNewerThan(androidId: Long, limit: Int = 20, since: Long? = null): List<JSObject> {
        val projection = CallLogMapper.getProjection()
        val calls = mutableListOf<JSObject>()

        val selection = StringBuilder("${CallLog.Calls._ID} > ?")
        val selectionArgs = mutableListOf(androidId.toString())

        if (since != null && since > 0) {
            selection.append(" AND ${CallLog.Calls.DATE} >= ?")
            selectionArgs.add(since.toString())
        }

        context.contentResolver.query(
            CallLog.Calls.CONTENT_URI,
            projection,
            selection.toString(),
            selectionArgs.toTypedArray(),
            "${CallLog.Calls._ID} ASC"
        )?.use { cursor ->
            while (cursor.moveToNext() && calls.size < limit) {
                CallLogMapper.cursorToJSObject(cursor, deviceId, contactNameResolver)
                    ?.let { calls.add(it) }
            }
        }

        return calls
    }
}
