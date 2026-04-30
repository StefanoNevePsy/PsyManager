import { create } from 'zustand'
import { Capacitor } from '@capacitor/core'
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth'
import {
  GoogleTokenInfo,
  loadGoogleApi,
  getStoredToken,
  requestAccessToken,
  ensureValidToken,
  clearToken,
  saveToken,
} from '@/lib/googleCalendar'

interface GoogleCalendarState {
  token: GoogleTokenInfo | null
  loading: boolean
  initialized: boolean
  error: string | null

  initialize: () => Promise<void>
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  isConnected: () => boolean
  refreshSilently: () => Promise<boolean>
}

let refreshTimer: number | null = null

const scheduleAutoRefresh = (
  token: GoogleTokenInfo | null,
  refresh: () => Promise<boolean>
) => {
  if (refreshTimer !== null) {
    window.clearTimeout(refreshTimer)
    refreshTimer = null
  }
  if (!token) return
  // Refresh 5 minutes before expiry (or immediately if it's that close)
  const msUntilRefresh = Math.max(0, token.expires_at - Date.now() - 5 * 60 * 1000)
  refreshTimer = window.setTimeout(() => {
    void refresh()
  }, msUntilRefresh)
}

export const useGoogleCalendarStore = create<GoogleCalendarState>((set, get) => ({
  token: null,
  loading: false,
  initialized: false,
  error: null,

  initialize: async () => {
    try {
      const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || ''

      // On native, initialize the plugin
      if (Capacitor.isNativePlatform()) {
        if (!clientId) {
          set({ token: null, initialized: true })
          return
        }
        await GoogleAuth.initialize({ clientId, scopes: ['https://www.googleapis.com/auth/calendar'] })

        // Check if user is already signed in and has a valid token
        const stored = getStoredToken()
        if (stored) {
          set({ token: stored, initialized: true })
          scheduleAutoRefresh(stored, get().refreshSilently)
          return
        }

        // User not signed in initially, that's okay — they can click "Connect" later
        // Don't try to auto-sign-in on native to avoid showing UI during app startup

        set({ token: null, initialized: true })
      } else {
        // Web platform: load GIS and try silent refresh
        await loadGoogleApi()
        const stored = getStoredToken()

        if (stored) {
          set({ token: stored, initialized: true })
          scheduleAutoRefresh(stored, get().refreshSilently)
        } else if (clientId) {
          // No valid token in storage — try silent refresh in case Google still
          // recognizes the user (e.g., session is alive in the browser/WebView).
          // This makes the experience seamless when reopening the app.
          const fresh = await ensureValidToken(clientId)
          set({ token: fresh, initialized: true })
          if (fresh) scheduleAutoRefresh(fresh, get().refreshSilently)
        } else {
          set({ token: null, initialized: true })
        }
      }
    } catch (error) {
      set({
        initialized: true,
        error: error instanceof Error ? error.message : 'Failed to initialize',
      })
    }
  },

  connect: async () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) {
      set({ error: 'Google Client ID not configured' })
      return
    }

    set({ loading: true, error: null })

    try {
      if (Capacitor.isNativePlatform()) {
        // Native: use plugin sign-in
        const token = await requestAccessToken(clientId)
        set({ token, loading: false })
        scheduleAutoRefresh(token, get().refreshSilently)
      } else {
        // Web: load GIS and use it
        await loadGoogleApi()
        const token = await requestAccessToken(clientId)
        set({ token, loading: false })
        scheduleAutoRefresh(token, get().refreshSilently)
      }
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      })
    }
  },

  disconnect: async () => {
    if (refreshTimer !== null) {
      window.clearTimeout(refreshTimer)
      refreshTimer = null
    }
    clearToken()
    set({ token: null })

    // On native, sign out of the plugin as well
    if (Capacitor.isNativePlatform()) {
      try {
        await GoogleAuth.signOut()
      } catch {
        // Ignore errors during sign-out
      }
    }
  },

  isConnected: () => !!get().token,

  refreshSilently: async () => {
    const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || ''
    if (!clientId) return false
    try {
      if (Capacitor.isNativePlatform()) {
        // Native: try to refresh token via plugin
        try {
          const auth = await GoogleAuth.refresh()
          if (auth.accessToken) {
            const tokenInfo: GoogleTokenInfo = {
              access_token: auth.accessToken,
              expires_at: Date.now() + 3600 * 1000,
              scope: 'https://www.googleapis.com/auth/calendar',
            }
            saveToken(tokenInfo)
            set({ token: tokenInfo })
            scheduleAutoRefresh(tokenInfo, get().refreshSilently)
            return true
          }
        } catch {
          set({ token: null })
          return false
        }
      } else {
        // Web: use existing GIS flow
        const fresh = await ensureValidToken(clientId)
        if (fresh) {
          set({ token: fresh })
          scheduleAutoRefresh(fresh, get().refreshSilently)
          return true
        }
        // Silent refresh failed — token is gone, surface to UI
        set({ token: null })
        return false
      }
    } catch {
      set({ token: null })
      return false
    }
    return false
  },
}))
