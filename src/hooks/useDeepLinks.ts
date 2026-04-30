import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'

/**
 * Handles deep links of the form `psymanager://<path>` triggered from the
 * Android home-screen widget.
 *
 *   psymanager://sessions          → go to the sessions page
 *   psymanager://session/<id>      → go to the sessions page and open the
 *                                    edit modal for that session
 *
 * Works for cold starts (via App.getLaunchUrl) and warm starts (via
 * App.appUrlOpen). No-op on the web.
 */
export function useDeepLinks() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    const handleUrl = (url: string) => {
      try {
        // Use a permissive parser since the URL is locally generated
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
        // Ignore malformed URLs
      }
    }

    let listener: { remove: () => void } | null = null
    CapacitorApp.addListener('appUrlOpen', ({ url }) => handleUrl(url)).then(
      (handle) => {
        listener = handle
      }
    )

    // Cold start: check if the app was launched via a deep link
    CapacitorApp.getLaunchUrl().then((res) => {
      if (res?.url) handleUrl(res.url)
    })

    return () => {
      if (listener) listener.remove()
    }
  }, [navigate])
}
