import { create } from 'zustand'
import {
  GoogleTokenInfo,
  loadGoogleApi,
  getStoredToken,
  requestAccessToken,
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
}

export const useGoogleCalendarStore = create<GoogleCalendarState>((set, get) => ({
  token: null,
  loading: false,
  initialized: false,
  error: null,

  initialize: async () => {
    try {
      await loadGoogleApi()
      const stored = getStoredToken()
      set({ token: stored, initialized: true })
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
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      })
    }
  },

  disconnect: () => {
    clearToken()
    set({ token: null })
  },

  isConnected: () => !!get().token,
}))
