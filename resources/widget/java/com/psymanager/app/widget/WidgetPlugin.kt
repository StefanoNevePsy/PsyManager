package com.psymanager.app.widget

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "SessionsWidget")
class WidgetPlugin : Plugin() {

    @PluginMethod
    fun updateSessions(call: PluginCall) {
        try {
            val sessionsArray = call.getArray("sessions")
            if (sessionsArray == null) {
                call.reject("Missing 'sessions' array")
                return
            }

            android.util.Log.d("WidgetPlugin", "updateSessions called with ${sessionsArray.length()} items")

            val context = context
            val prefs = context.getSharedPreferences(WidgetStorage.PREFS_NAME, 0)
            val jsonString = sessionsArray.toString()
            prefs.edit()
                .putString(WidgetStorage.KEY_SESSIONS_JSON, jsonString)
                .putLong(WidgetStorage.KEY_UPDATED_AT, System.currentTimeMillis())
                .apply()

            android.util.Log.d("WidgetPlugin", "Saved ${jsonString.length} bytes to prefs")

            SessionsWidgetProvider.redrawAll(context)
            android.util.Log.d("WidgetPlugin", "redrawAll called")

            // Make sure the daily midnight alarm is scheduled
            WidgetAlarmScheduler.scheduleDailyRefresh(context)

            call.resolve()
        } catch (e: Exception) {
            android.util.Log.e("WidgetPlugin", "updateSessions failed", e)
            call.reject("updateSessions failed: ${e.message}")
        }
    }

    @PluginMethod
    fun clearSessions(call: PluginCall) {
        val context = context
        val prefs = context.getSharedPreferences(WidgetStorage.PREFS_NAME, 0)
        prefs.edit().clear().apply()
        SessionsWidgetProvider.redrawAll(context)
        call.resolve()
    }

    @PluginMethod
    fun consumePendingSessionId(call: PluginCall) {
        val context = context
        val prefs = context.getSharedPreferences(WidgetStorage.PREFS_NAME, 0)
        val sessionId = prefs.getString(WidgetStorage.KEY_PENDING_SESSION_ID, null)
        if (sessionId != null) {
            prefs.edit().remove(WidgetStorage.KEY_PENDING_SESSION_ID).apply()
        }
        val ret = JSObject()
        ret.put("sessionId", sessionId)
        call.resolve(ret)
    }

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val ret = JSObject()
        ret.put("available", true)
        call.resolve(ret)
    }
}
