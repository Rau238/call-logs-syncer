package com.enterprisecalllog.plugin

import android.content.Context
import android.net.Uri
import android.provider.ContactsContract
import android.util.LruCache

/**
 * Resolves contact display names from phone numbers using ContactsContract.
 * Uses an LRU cache to avoid repeated ContentResolver queries.
 */
class ContactNameResolver(private val context: Context) {

    private val cache = LruCache<String, String>(256)

    fun clearCache() {
        cache.evictAll()
    }

    fun invalidate(phoneNumber: String) {
        if (phoneNumber.isNotBlank()) {
            cache.remove(phoneNumber)
        }
    }

    fun resolve(phoneNumber: String): String {
        if (phoneNumber.isBlank()) return ""

        cache.get(phoneNumber)?.let { return it }

        val uri = Uri.withAppendedPath(
            ContactsContract.PhoneLookup.CONTENT_FILTER_URI,
            Uri.encode(phoneNumber)
        )

        val projection = arrayOf(ContactsContract.PhoneLookup.DISPLAY_NAME)

        var name = ""
        context.contentResolver.query(
            uri,
            projection,
            null,
            null,
            null
        )?.use { cursor ->
            if (cursor.moveToFirst()) {
                val index = cursor.getColumnIndex(ContactsContract.PhoneLookup.DISPLAY_NAME)
                if (index >= 0) {
                    name = cursor.getString(index) ?: ""
                }
            }
        }

        cache.put(phoneNumber, name)
        return name
    }
}
