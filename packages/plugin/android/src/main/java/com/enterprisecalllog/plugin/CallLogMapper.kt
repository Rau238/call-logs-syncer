package com.enterprisecalllog.plugin

import android.database.Cursor
import android.provider.CallLog
import android.telephony.PhoneNumberUtils
import com.getcapacitor.JSObject

/**
 * Maps Android CallLog Cursor rows to Capacitor JSON objects.
 */
object CallLogMapper {

    fun mapCallType(androidType: Int): String = when (androidType) {
        CallLog.Calls.INCOMING_TYPE -> "INCOMING"
        CallLog.Calls.OUTGOING_TYPE -> "OUTGOING"
        CallLog.Calls.MISSED_TYPE -> "MISSED"
        CallLog.Calls.VOICEMAIL_TYPE -> "VOICEMAIL"
        5 -> "REJECTED"
        6 -> "BLOCKED"
        else -> "UNKNOWN"
    }

    fun cursorToJSObject(
        cursor: Cursor,
        deviceId: String,
        contactNameResolver: ContactNameResolver?
    ): JSObject? {
        val idIndex = cursor.getColumnIndex(CallLog.Calls._ID)
        val numberIndex = cursor.getColumnIndex(CallLog.Calls.NUMBER)
        val cachedNameIndex = cursor.getColumnIndex(CallLog.Calls.CACHED_NAME)
        val cachedLabelIndex = cursor.getColumnIndex(CallLog.Calls.CACHED_NUMBER_LABEL)
        val typeIndex = cursor.getColumnIndex(CallLog.Calls.TYPE)
        val durationIndex = cursor.getColumnIndex(CallLog.Calls.DURATION)
        val dateIndex = cursor.getColumnIndex(CallLog.Calls.DATE)
        val countryIsoIndex = cursor.getColumnIndex(CallLog.Calls.COUNTRY_ISO)
        val geoIndex = cursor.getColumnIndex(CallLog.Calls.GEOCODED_LOCATION)
        val phoneAccountIndex = cursor.getColumnIndex(CallLog.Calls.PHONE_ACCOUNT_ID)
        val simIndex = cursor.getColumnIndex("subscription_id")

        if (idIndex < 0 || typeIndex < 0 || dateIndex < 0) return null

        val androidId = cursor.getLong(idIndex)
        val rawNumber = if (numberIndex >= 0) cursor.getString(numberIndex) ?: "" else ""
        val phoneNumber = normalizePhoneNumber(rawNumber)
        val cachedName = if (cachedNameIndex >= 0) cursor.getString(cachedNameIndex) ?: "" else ""
        val cachedLabel = if (cachedLabelIndex >= 0) cursor.getString(cachedLabelIndex) ?: "" else ""
        val callType = mapCallType(cursor.getInt(typeIndex))
        val duration = if (durationIndex >= 0) cursor.getLong(durationIndex) else 0L
        val callTime = cursor.getLong(dateIndex)
        val countryIso = if (countryIsoIndex >= 0) cursor.getString(countryIsoIndex) ?: "" else ""
        val geocodedLocation = if (geoIndex >= 0) cursor.getString(geoIndex) ?: "" else ""
        val phoneAccountId = if (phoneAccountIndex >= 0) cursor.getString(phoneAccountIndex) ?: "" else ""

        val contactName = if (
            contactNameResolver != null &&
            (phoneNumber.isNotBlank() || rawNumber.isNotBlank())
        ) {
            contactNameResolver.resolve(phoneNumber.ifBlank { rawNumber })
        } else if (cachedName.isNotBlank()) {
            cachedName
        } else {
            ""
        }

        val simSlot = if (simIndex >= 0) {
            val subId = cursor.getInt(simIndex)
            if (subId >= 0) subId else -1
        } else {
            -1
        }

        val hash = CallLogHashUtil.generate(
            deviceId = deviceId,
            phoneNumber = phoneNumber.ifBlank { rawNumber },
            callTime = callTime,
            duration = duration,
            callType = callType
        )

        return JSObject().apply {
            put("androidId", androidId)
            put("phoneNumber", phoneNumber.ifBlank { rawNumber })
            put("contactName", contactName)
            put("callType", callType)
            put("duration", duration)
            put("callTime", callTime)
            put("simSlot", simSlot)
            put("deviceId", deviceId)
            put("hash", hash)
            if (cachedLabel.isNotBlank()) put("cachedNumberLabel", cachedLabel)
            if (geocodedLocation.isNotBlank()) put("geocodedLocation", geocodedLocation)
            if (countryIso.isNotBlank()) put("countryIso", countryIso)
            if (phoneAccountId.isNotBlank()) put("phoneAccountId", phoneAccountId)
        }
    }

    private fun normalizePhoneNumber(number: String): String {
        if (number.isBlank()) return ""
        val stripped = PhoneNumberUtils.stripSeparators(number) ?: number
        return stripped.trim()
    }

    fun getProjection(): Array<String> {
        val columns = mutableListOf(
            CallLog.Calls._ID,
            CallLog.Calls.NUMBER,
            CallLog.Calls.CACHED_NAME,
            CallLog.Calls.CACHED_NUMBER_LABEL,
            CallLog.Calls.TYPE,
            CallLog.Calls.DURATION,
            CallLog.Calls.DATE,
            CallLog.Calls.COUNTRY_ISO,
            CallLog.Calls.GEOCODED_LOCATION,
            CallLog.Calls.PHONE_ACCOUNT_ID
        )
        columns.add("subscription_id")
        return columns.toTypedArray()
    }
}
