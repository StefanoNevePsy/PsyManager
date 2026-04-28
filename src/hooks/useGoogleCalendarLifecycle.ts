import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { useGoogleCalendarStore } from '@/stores/googleCalendarStore'

/**
 * Initializes the Google Calendar store on app load and refreshes the token
 * silently whenever the app returns to the foreground (browser visibility
 * change, or Capacitor appStateChange on Android).
 *
 * This minimizes the chances of the user being asked to re-authenticate:
 * - On app start: try silent refresh if no valid token in storage
 * - On returning to the app: re-validate the token, refresh if expiring
 * - The store also schedules a proactive refresh 5 min before expiry
 *
 * Capacitor note: On Android the WebView may not have an active Google
 * session, so silent refresh can fail. In that case the UI surfaces a
 * "Reconnect" button via isConnected() returning false.
 */
export function useGoogleCalendarLifecycle() {
  const initialize = useGoogleCalendarStore((s) => s.initialize)
  const refreshSilently = useGoogleCalendarStore((s) => s.refreshSilently)
  const token = useGoogleCalendarStore((s) => s.token)

  // Initialize on mount
  useEffect(() => {
    initialize()
  }, [initialize])

  // Refresh on app foreground
  useEffect(() => {
    const checkAndRefresh = () => {
      const current = useGoogleCalendarStore.getState().token
      if (!current) {
        // No token — try silent refresh in case Google still recognizes us
        void refreshSilently()
        return
      }
      // Token exists — refresh if expiring within 5 minutes
      const fiveMinutes = 5 * 60 * 1000
      if (current.expires_at - Date.now() < fiveMinutes) {
        void refreshSilently()
      }
    }

    // Browser: visibilitychange fires when tab becomes visible
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkAndRefresh()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    // Capacitor: appStateChange fires when app comes to foreground
    let capListener: { remove: () => void } | null = null
    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) checkAndRefresh()
      }).then((handle) => {
        capListener = handle
      })
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      if (capListener) capListener.remove()
    }
  }, [refreshSilently])

  return { isConnected: !!token }
}
