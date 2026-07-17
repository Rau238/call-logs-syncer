package com.enterprisecalllog.plugin

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.WifiManager
import android.os.Build
import android.telephony.TelephonyManager
import com.getcapacitor.JSObject

object NetworkInfoHelper {

    fun read(context: Context): JSObject {
        val result = JSObject()
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        var connected = false
        var connectionType = "unknown"
        var networkName = ""

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val network = cm.activeNetwork
            val caps = cm.getNetworkCapabilities(network)
            connected = caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)

            when {
                caps?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true -> {
                    connectionType = "wifi"
                    networkName = readWifiName(context)
                }
                caps?.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) == true -> {
                    connectionType = "cellular"
                    networkName = readCarrierName(context)
                }
                caps?.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) == true -> {
                    connectionType = "ethernet"
                    networkName = "Ethernet"
                }
                !connected -> connectionType = "none"
            }
        } else {
            @Suppress("DEPRECATION")
            val info = cm.activeNetworkInfo
            connected = info?.isConnected == true
            @Suppress("DEPRECATION")
            when (info?.type) {
                ConnectivityManager.TYPE_WIFI -> {
                    connectionType = "wifi"
                    networkName = readWifiName(context)
                }
                ConnectivityManager.TYPE_MOBILE -> {
                    connectionType = "cellular"
                    networkName = readCarrierName(context)
                }
                else -> if (!connected) connectionType = "none"
            }
        }

        result.put("connected", connected)
        result.put("connectionType", connectionType)
        result.put("networkName", networkName.ifBlank { defaultName(connectionType) })
        return result
    }

    private fun readWifiName(context: Context): String {
        return try {
            val wm = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
            @Suppress("DEPRECATION")
            val ssid = wm.connectionInfo?.ssid?.replace("\"", "")?.trim() ?: ""
            when {
                ssid.isBlank() || ssid == "<unknown ssid>" -> "Wi‑Fi"
                else -> ssid
            }
        } catch (_: Exception) {
            "Wi‑Fi"
        }
    }

    private fun readCarrierName(context: Context): String {
        return try {
            val tm = context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
            tm.networkOperatorName?.trim()?.ifBlank { null } ?: "Mobile network"
        } catch (_: Exception) {
            "Mobile network"
        }
    }

    private fun defaultName(connectionType: String): String = when (connectionType) {
        "wifi" -> "Wi‑Fi"
        "cellular" -> "Mobile network"
        "none" -> "Offline"
        else -> "Unknown"
    }
}
