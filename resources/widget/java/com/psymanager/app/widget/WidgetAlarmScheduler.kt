package com.psymanager.app.widget

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.util.Log
import java.util.Calendar

object WidgetAlarmScheduler {

    private const val TAG = "WidgetAlarmScheduler"

    fun scheduleDailyRefresh(context: Context) {
        try {
            val alarm = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
                ?: return
            val pi = buildPendingIntent(context)

            // Trigger at the next 00:05 to reflect the new day's sessions.
            // Using 00:05 (instead of 00:01) gives the OS some breathing room
            // and avoids edge cases right at midnight.
            val cal = Calendar.getInstance().apply {
                add(Calendar.DAY_OF_YEAR, 1)
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 5)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }

            // One-shot inexact alarm. We re-arm it from onReceive after each
            // tick. This avoids issues with setInexactRepeating on newer
            // Android versions where battery optimization can suppress
            // repeating alarms entirely.
            alarm.set(
                AlarmManager.RTC,
                cal.timeInMillis,
                pi
            )
        } catch (e: Exception) {
            Log.w(TAG, "Failed to schedule daily widget refresh", e)
        }
    }

    fun cancelDailyRefresh(context: Context) {
        try {
            val alarm = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
                ?: return
            alarm.cancel(buildPendingIntent(context))
        } catch (e: Exception) {
            Log.w(TAG, "Failed to cancel daily widget refresh", e)
        }
    }

    private fun buildPendingIntent(context: Context): PendingIntent {
        val intent = Intent(context, SessionsWidgetProvider::class.java).apply {
            action = WidgetStorage.ACTION_DAILY_TICK
        }
        return PendingIntent.getBroadcast(
            context,
            42,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }
}
