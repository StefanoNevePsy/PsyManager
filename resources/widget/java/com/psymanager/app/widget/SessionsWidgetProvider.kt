package com.psymanager.app.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import com.psymanager.app.MainActivity
import com.psymanager.app.R

class SessionsWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (id in appWidgetIds) {
            updateWidget(context, appWidgetManager, id)
        }
        WidgetAlarmScheduler.scheduleDailyRefresh(context)
    }

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        WidgetAlarmScheduler.scheduleDailyRefresh(context)
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        WidgetAlarmScheduler.cancelDailyRefresh(context)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        when (intent.action) {
            WidgetStorage.ACTION_REFRESH,
            WidgetStorage.ACTION_DAILY_TICK -> {
                redrawAll(context)
                if (intent.action == WidgetStorage.ACTION_DAILY_TICK) {
                    // Re-arm the alarm for the next day
                    WidgetAlarmScheduler.scheduleDailyRefresh(context)
                }
            }
        }
    }

    companion object {
        fun redrawAll(context: Context) {
            val mgr = AppWidgetManager.getInstance(context)
            val ids = mgr.getAppWidgetIds(
                ComponentName(context, SessionsWidgetProvider::class.java)
            )
            for (id in ids) {
                updateWidget(context, mgr, id)
            }
            if (ids.isNotEmpty()) {
                mgr.notifyAppWidgetViewDataChanged(ids, R.id.widget_sessions_list)
            }
        }

        private fun updateWidget(
            context: Context,
            mgr: AppWidgetManager,
            appWidgetId: Int
        ) {
            val views = RemoteViews(context.packageName, R.layout.widget_sessions)

            // Bind the ListView to the RemoteViewsService
            val serviceIntent = Intent(context, SessionsWidgetService::class.java).apply {
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
                data = Uri.parse(toUri(Intent.URI_INTENT_SCHEME))
            }
            views.setRemoteAdapter(R.id.widget_sessions_list, serviceIntent)
            views.setEmptyView(R.id.widget_sessions_list, R.id.widget_sessions_empty)

            // Header click → open the app on /sessions
            val openAppIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                data = Uri.parse("psymanager://sessions")
            }
            val openAppPI = PendingIntent.getActivity(
                context,
                0,
                openAppIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_header, openAppPI)
            views.setOnClickPendingIntent(R.id.widget_sessions_empty, openAppPI)

            // Refresh button → trigger redraw
            val refreshIntent = Intent(context, SessionsWidgetProvider::class.java).apply {
                action = WidgetStorage.ACTION_REFRESH
            }
            val refreshPI = PendingIntent.getBroadcast(
                context,
                0,
                refreshIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_refresh, refreshPI)

            // Per-item click → use a template PendingIntent. The factory fills
            // in the per-row data URI when binding each row.
            val itemTemplateIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                action = Intent.ACTION_VIEW
            }
            val itemTemplatePI = PendingIntent.getActivity(
                context,
                1,
                itemTemplateIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_MUTABLE
            )
            views.setPendingIntentTemplate(R.id.widget_sessions_list, itemTemplatePI)

            mgr.updateAppWidget(appWidgetId, views)
        }
    }
}
