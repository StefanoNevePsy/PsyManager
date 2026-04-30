import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { LocalNotifications } from '@capacitor/local-notifications'

/**
 * Handles deep links from the Android home-screen widget and taps on local
 * reminder notifications.
 *
 * Widget URLs:
 *   psymanager://sessions       → go to the sessions page
 *   psymanager://session/<id>   → open the edit modal for that session
 *
 * Notification taps carry { sessionId, kind } in the notification's `extra`:
 *   kind = 'pre'  → open the session modal
 *   kind = 'post' → open the session modal AND the payment modal
 *
 * Works for cold starts (App.getLaunchUrl) and warm starts (App.appUrlOpen
 * and localNotificationActionPerformed). No-op on the web.
 */
export function useDeepLinks() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const handleUrl = (url: string) => {
      try {
        const m = url.match(/^psymanager:\/\/(.*)$/)
        if (!m) return
        const path = m[1]
        if (!path) return

        if (path.startsWith('session/')) {
          const sessionId = path.substring('session/'.length).split(/[/?#]/)[0]
          if (sessionId) {
            navigate('/sessions', { state: { editSessionId: sessionId } })
            return
          }
        }
        if (path.startsWith('sessions')) {
          navigate('/sessions')
        }
      } catch {
        // ignore malformed URLs
      }
    }

    const handleNotification = (extra: unknown) => {
      if (!extra || typeof extra !== 'object') return
      const data = extra as { sessionId?: string; kind?: 'pre' | 'post' }
      if (!data.sessionId) return
      const state =
        data.kind === 'post'
          ? { editSessionId: data.sessionId, openPayment: true }
          : { editSessionId: data.sessionId }
      navigate('/sessions', { state })
    }

    const removers: Array<{ remove: () => void }> = []

    CapacitorApp.addListener('appUrlOpen', ({ url }) => handleUrl(url)).then(
      (h) => removers.push(h)
    )

    LocalNotifications.addListener(
      'localNotificationActionPerformed',
      (action) => handleNotification(action.notification.extra)
    ).then((h) => removers.push(h))

    CapacitorApp.getLaunchUrl().then((res) => {
      if (res?.url) handleUrl(res.url)
    })

    return () => {
      for (const r of removers) r.remove()
    }
  }, [navigate])
}
