package com.psymanager.app.widget

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.text.format.DateFormat
import android.widget.RemoteViews
import android.widget.RemoteViewsService
import com.psymanager.app.R
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class SessionsWidgetService : RemoteViewsService() {
    override fun onGetViewFactory(intent: Intent): RemoteViewsFactory {
        return SessionsRemoteViewsFactory(applicationContext)
    }
}

private data class WidgetSession(
    val id: String,
    val startMs: Long,
    val endMs: Long,
    val patientName: String,
    val serviceName: String,
    val balance: Double
)

class SessionsRemoteViewsFactory(
    private val context: Context
) : RemoteViewsService.RemoteViewsFactory {

    private var items: List<WidgetSession> = emptyList()

    override fun onCreate() {}

    override fun onDestroy() {
        items = emptyList()
    }

    override fun onDataSetChanged() {
        items = loadTodaySessions(context)
    }

    override fun getCount(): Int = items.size

    override fun getViewAt(position: Int): RemoteViews {
        val item = items[position]
        val rv = RemoteViews(context.packageName, R.layout.widget_session_item)

        val now = System.currentTimeMillis()
        val isCompleted = item.endMs <= now

        val timeFmt = SimpleDateFormat(
            if (DateFormat.is24HourFormat(context)) "HH:mm" else "h:mm a",
            Locale.getDefault()
        )
        val timeText = timeFmt.format(Date(item.startMs))

        rv.setTextViewText(R.id.item_time, timeText)
        rv.setTextViewText(R.id.item_patient, item.patientName)
        rv.setTextViewText(R.id.item_service, item.serviceName)

        // Visual state: completed vs upcoming
        if (isCompleted) {
            val grey = 0xFF94A3B8.toInt() // slate-400
            rv.setTextColor(R.id.item_time, grey)
            rv.setTextColor(R.id.item_patient, grey)
            rv.setTextColor(R.id.item_service, grey)
            rv.setInt(R.id.item_row, "setBackgroundResource", R.drawable.widget_item_bg_completed)
        } else {
            val fg = 0xFFE2E8F0.toInt() // slate-200
            val muted = 0xFF94A3B8.toInt()
            rv.setTextColor(R.id.item_time, 0xFFFFFFFF.toInt())
            rv.setTextColor(R.id.item_patient, fg)
            rv.setTextColor(R.id.item_service, muted)
            rv.setInt(R.id.item_row, "setBackgroundResource", R.drawable.widget_item_bg)
        }

        // Balance dot: red if owes money, green if credit, hidden if ~0
        when {
            item.balance >= 0.01 -> {
                rv.setViewVisibility(R.id.item_balance_dot, android.view.View.VISIBLE)
                rv.setInt(R.id.item_balance_dot, "setColorFilter", 0xFFEF4444.toInt()) // red-500
            }
            item.balance <= -0.01 -> {
                rv.setViewVisibility(R.id.item_balance_dot, android.view.View.VISIBLE)
                rv.setInt(R.id.item_balance_dot, "setColorFilter", 0xFF22C55E.toInt()) // green-500
            }
            else -> {
                rv.setViewVisibility(R.id.item_balance_dot, android.view.View.GONE)
            }
        }

        // Per-item click intent: fills in the data URI used by the template
        val fillIn = Intent().apply {
            data = Uri.parse("psymanager://session/${item.id}")
        }
        rv.setOnClickFillInIntent(R.id.item_row, fillIn)

        return rv
    }

    override fun getLoadingView(): RemoteViews? = null
    override fun getViewTypeCount(): Int = 1
    override fun getItemId(position: Int): Long = items[position].id.hashCode().toLong()
    override fun hasStableIds(): Boolean = true

    private fun loadTodaySessions(ctx: Context): List<WidgetSession> {
        val prefs = ctx.getSharedPreferences(WidgetStorage.PREFS_NAME, 0)
        val json = prefs.getString(WidgetStorage.KEY_SESSIONS_JSON, null) ?: return emptyList()

        val (todayStart, todayEnd) = todayBoundsMs()
        val out = mutableListOf<WidgetSession>()

        try {
            val arr = JSONArray(json)
            for (i in 0 until arr.length()) {
                val obj = arr.optJSONObject(i) ?: continue
                val item = parseSession(obj) ?: continue
                if (item.startMs in todayStart until todayEnd) {
                    out.add(item)
                }
            }
        } catch (_: Exception) {
            return emptyList()
        }

        out.sortBy { it.startMs }
        return out
    }

    private fun parseSession(obj: JSONObject): WidgetSession? {
        return try {
            val id = obj.optString("id").takeIf { it.isNotEmpty() } ?: return null
            val scheduledAt = obj.optString("scheduledAt").takeIf { it.isNotEmpty() }
                ?: return null
            val durationMin = obj.optInt("durationMinutes", 60)
            val patient = obj.optString("patientName", "")
            val service = obj.optString("serviceName", "")
            val balance = obj.optDouble("balance", 0.0)

            val startMs = parseIsoMs(scheduledAt) ?: return null
            val endMs = startMs + durationMin * 60_000L

            WidgetSession(id, startMs, endMs, patient, service, balance)
        } catch (_: Exception) {
            null
        }
    }

    private fun parseIsoMs(iso: String): Long? {
        // Accept common ISO-8601 forms (with or without milliseconds, Z or offset)
        val patterns = listOf(
            "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
            "yyyy-MM-dd'T'HH:mm:ssXXX",
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            "yyyy-MM-dd'T'HH:mm:ss'Z'"
        )
        for (p in patterns) {
            try {
                val sdf = SimpleDateFormat(p, Locale.US)
                sdf.timeZone = TimeZone.getTimeZone("UTC")
                return sdf.parse(iso)?.time
            } catch (_: Exception) {
                // try next pattern
            }
        }
        return null
    }

    private fun todayBoundsMs(): Pair<Long, Long> {
        val cal = Calendar.getInstance()
        cal.set(Calendar.HOUR_OF_DAY, 0)
        cal.set(Calendar.MINUTE, 0)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        val start = cal.timeInMillis
        cal.add(Calendar.DAY_OF_YEAR, 1)
        val end = cal.timeInMillis
        return start to end
    }
}

