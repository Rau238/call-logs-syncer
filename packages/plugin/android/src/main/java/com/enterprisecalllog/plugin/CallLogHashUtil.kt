package com.enterprisecalllog.plugin

import java.security.MessageDigest

/**
 * Generates deterministic SHA-256 hashes for call log deduplication.
 *
 * Hash formula: SHA-256(deviceId + phoneNumber + callTime + duration + callType)
 * This matches the contract in definitions.ts.
 */
object CallLogHashUtil {

    fun generate(
        deviceId: String,
        phoneNumber: String,
        callTime: Long,
        duration: Long,
        callType: String
    ): String {
        val payload = "$deviceId|$phoneNumber|$callTime|$duration|$callType"
        val digest = MessageDigest.getInstance("SHA-256")
        val bytes = digest.digest(payload.toByteArray(Charsets.UTF_8))
        return bytes.joinToString("") { "%02x".format(it) }
    }
}
