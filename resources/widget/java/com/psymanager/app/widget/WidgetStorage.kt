package com.psymanager.app.widget

object WidgetStorage {
    const val PREFS_NAME = "psymanager_widget"
    const val KEY_SESSIONS_JSON = "sessions_json"
    const val KEY_UPDATED_AT = "updated_at"
    const val KEY_PENDING_SESSION_ID = "pending_session_id"

    const val ACTION_REFRESH = "com.psymanager.app.widget.ACTION_REFRESH"
    const val ACTION_DAILY_TICK = "com.psymanager.app.widget.ACTION_DAILY_TICK"
    const val EXTRA_SESSION_ID = "extra_session_id"
}
