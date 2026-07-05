import { useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { useGoogleCalendarStore } from '@/stores/googleCalendarStore'
import { useGoogleCalendarSync } from './useGoogleCalendarSync'

// Same key useGoogleCalendarSync.fullSync writes on success — read here so
// the throttle survives remounts and is shared with any manual sync too.
const LAST_SYNC_KEY = 'psymanager:gcal_last_sync'
const THROTTLE_MS = 10 * 60 * 1000 // 10 minutes

/**
 * Keeps Google Calendar in sync automatically, without any user action:
 * - once on mount (e.g. app start / page load)
 * - when the native app returns to the foreground (Capacitor appStateChange)
 * - when the browser tab becomes visible again (visibilitychange)
 *
 * Guards:
 * - throttled to at most once every 10 minutes (via the same localStorage
 *   timestamp the manual "Sincronizza Ora" button also updates)
 * - skipped when not connected to Google, or when the browser reports
 *   offline (navigator.onLine === false)
 * - overlapping runs are prevented with a ref flag — a slow sync in flight
 *   blocks a second trigger (e.g. mount + immediate visibilitychange) from
 *   starting another one
 *
 * Not mounted anywhere by this file — mount once near the app root so it
 * runs for the lifetime of the app.
 */
export function useAutoCalendarSync() {
  const isConnected = useGoogleCalendarStore((s) => s.isConnected)
  const { fullSync } = useGoogleCalendarSync()

  const runningRef = useRef(false)
  // Keep the latest callbacks in refs so the listener-setup effect below can
  // run once (empty deps) instead of tearing down/re-attaching listeners
  // every time `sessions` (and therefore `fullSync`) changes identity.
  const fullSyncRef = useRef(fullSync)
  const isConnectedRef = useRef(isConnected)

  useEffect(() => {
    fullSyncRef.current = fullSync
    isConnectedRef.current = isConnected
  }, [fullSync, isConnected])

  useEffect(() => {
    const maybeSync = () => {
      if (runningRef.current) return
      if (!isConnectedRef.current()) return
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return

      const raw = localStorage.getItem(LAST_SYNC_KEY)
      const lastSync = raw ? Number(raw) : null
      if (lastSync && !Number.isNaN(lastSync) && Date.now() - lastSync < THROTTLE_MS) {
        return
      }

      runningRef.current = true
      Promise.resolve(fullSyncRef.current())
        .catch(() => {
          // fullSync already surfaces errors via its own `error` state —
          // nothing else to do here besides not crashing the listener.
        })
        .finally(() => {
          runningRef.current = false
        })
    }

    // Run once on mount (covers app start / page load)
    maybeSync()

    const onVisibility = () => {
      if (document.visibilityState === 'visible') maybeSync()
    }
    document.addEventListener('visibilitychange', onVisibility)

    let capListener: { remove: () => void } | null = null
    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) maybeSync()
      }).then((handle) => {
        capListener = handle
      })
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      if (capListener) capListener.remove()
    }
  }, [])
}
