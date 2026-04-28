import { create } from 'zustand'
import {
  GoogleTokenInfo,
  loadGoogleApi,
  getStoredToken,
  requestAccessToken,
  ensureValidToken,
  clearToken,
} from '@/lib/googleCalendar'

interface GoogleCalendarState {
  token: GoogleTokenInfo | null
  loading: boolean
  initialized: boolean
  error: string | null

  initialize: () => Promise<void>
  connect: () => Promise<void>
  disconnect: () => void
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
      await loadGoogleApi()
      const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || ''
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
      await loadGoogleApi()
      const token = await requestAccessToken(clientId)
      set({ token, loading: false })
      scheduleAutoRefresh(token, get().refreshSilently)
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      })
    }
  },

  disconnect: () => {
    if (refreshTimer !== null) {
      window.clearTimeout(refreshTimer)
      refreshTimer = null
    }
    clearToken()
    set({ token: null })
  },

  isConnected: () => !!get().token,

  refreshSilently: async () => {
    const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || ''
    if (!clientId) return false
    try {
      const fresh = await ensureValidToken(clientId)
      if (fresh) {
        set({ token: fresh })
        scheduleAutoRefresh(fresh, get().refreshSilently)
        return true
      }
      // Silent refresh failed — token is gone, surface to UI
      set({ token: null })
      return false
    } catch {
      set({ token: null })
      return false
    }
  },
}))
