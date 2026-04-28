const GOOGLE_API_BASE = 'https://www.googleapis.com/calendar/v3'
const SCOPES = 'https://www.googleapis.com/auth/calendar'

const STORAGE_KEY = 'google_calendar_token'
// Refresh proactively when the token has less than 5 minutes left
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000

export interface GoogleTokenInfo {
  access_token: string
  expires_at: number
  scope: string
}

export interface GoogleCalendarEvent {
  id?: string
  summary: string
  description?: string
  start: { dateTime: string; timeZone?: string }
  end: { dateTime: string; timeZone?: string }
  extendedProperties?: {
    private?: Record<string, string>
  }
}

declare global {
  interface Window {
    google?: any
  }
}

export const isGoogleApiLoaded = () => {
  return typeof window !== 'undefined' && !!window.google?.accounts?.oauth2
}

export const loadGoogleApi = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (isGoogleApiLoaded()) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google API'))
    document.head.appendChild(script)
  })
}

export const getStoredToken = (): GoogleTokenInfo | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    const token = JSON.parse(stored) as GoogleTokenInfo
    if (token.expires_at < Date.now()) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return token
  } catch {
    return null
  }
}

export const saveToken = (token: GoogleTokenInfo) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(token))
}

export const clearToken = () => {
  localStorage.removeItem(STORAGE_KEY)
}

/**
 * Internal helper that wraps Google's initTokenClient + requestAccessToken.
 * - prompt='' attempts silent re-authentication (no UI) — Google returns a
 *   new token without showing anything to the user, as long as they're still
 *   logged into Google in the browser AND have previously consented.
 * - prompt='consent' (or undefined) shows the consent popup if needed.
 */
const requestToken = (
  clientId: string,
  silent: boolean
): Promise<GoogleTokenInfo> => {
  return new Promise((resolve, reject) => {
    if (!isGoogleApiLoaded()) {
      reject(new Error('Google API not loaded'))
      return
    }

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      // Silent: '' (empty string) tells Google to skip UI if possible.
      // Interactive: 'consent' is the default.
      prompt: silent ? '' : 'consent',
      callback: (response: {
        access_token: string
        expires_in: number
        scope: string
        error?: string
      }) => {
        if (response.error) {
          reject(new Error(response.error))
          return
        }
        const tokenInfo: GoogleTokenInfo = {
          access_token: response.access_token,
          expires_at: Date.now() + response.expires_in * 1000,
          scope: response.scope,
        }
        saveToken(tokenInfo)
        resolve(tokenInfo)
      },
    })

    tokenClient.requestAccessToken()
  })
}

export const requestAccessToken = (clientId: string) =>
  requestToken(clientId, false)

/**
 * Silently request a new access token without UI. Resolves with a fresh
 * token if Google still recognizes the user's session, or rejects if the
 * user needs to re-authenticate interactively.
 */
export const requestAccessTokenSilent = (clientId: string) =>
  requestToken(clientId, true)

/**
 * Returns the current token if still valid, otherwise attempts a silent
 * refresh. If the silent refresh fails, returns null — the caller should
 * prompt the user to reconnect.
 */
export const ensureValidToken = async (
  clientId: string
): Promise<GoogleTokenInfo | null> => {
  const stored = getStoredToken()
  if (stored && stored.expires_at - Date.now() > REFRESH_THRESHOLD_MS) {
    return stored
  }

  // Token missing, expired, or expiring soon — try silent refresh
  if (!clientId) return null
  try {
    await loadGoogleApi()
    const fresh = await requestAccessTokenSilent(clientId)
    return fresh
  } catch {
    return null
  }
}

const performFetch = async (
  path: string,
  options: RequestInit,
  token: GoogleTokenInfo
): Promise<Response> => {
  return fetch(`${GOOGLE_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
}

const apiCall = async <T>(
  path: string,
  options: RequestInit = {}
): Promise<T> => {
  const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || ''

  // Step 1: ensure we have a valid token (refreshing proactively if needed)
  let token = await ensureValidToken(clientId)
  if (!token) {
    // Fall back to whatever's stored — apiCall is a low-level call, callers
    // can decide to surface a "reconnect" prompt
    token = getStoredToken()
  }
  if (!token) throw new Error('Not authenticated with Google')

  let response = await performFetch(path, options, token)

  // Step 2: if Google rejects the token (e.g., revoked outside our control),
  // attempt one silent refresh and retry the request once.
  if (response.status === 401 && clientId) {
    try {
      const fresh = await requestAccessTokenSilent(clientId)
      response = await performFetch(path, options, fresh)
    } catch {
      // Silent refresh failed — clear token so UI shows "Reconnect"
      clearToken()
      throw new Error('Google authentication expired')
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearToken()
      throw new Error('Google authentication expired')
    }
    const error = await response.json().catch(() => ({}))
    throw new Error(
      error.error?.message || `Google API error: ${response.statusText}`
    )
  }

  if (response.status === 204) {
    return {} as T
  }

  return response.json()
}

export const listEvents = async (
  calendarId = 'primary',
  timeMin?: Date,
  timeMax?: Date
) => {
  const params = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  })

  if (timeMin) params.set('timeMin', timeMin.toISOString())
  if (timeMax) params.set('timeMax', timeMax.toISOString())

  const data = await apiCall<{ items: GoogleCalendarEvent[] }>(
    `/calendars/${encodeURIComponent(calendarId)}/events?${params}`
  )

  return data.items || []
}

export const createEvent = async (
  event: GoogleCalendarEvent,
  calendarId = 'primary'
) => {
  return apiCall<GoogleCalendarEvent>(
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      body: JSON.stringify(event),
    }
  )
}

export const updateEvent = async (
  eventId: string,
  event: Partial<GoogleCalendarEvent>,
  calendarId = 'primary'
) => {
  return apiCall<GoogleCalendarEvent>(
    `/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: 'PUT',
      body: JSON.stringify(event),
    }
  )
}

export const deleteEvent = async (
  eventId: string,
  calendarId = 'primary'
) => {
  return apiCall<void>(
    `/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: 'DELETE',
    }
  )
}

export const sessionToGoogleEvent = (
  patientName: string,
  serviceName: string,
  scheduledAt: string,
  durationMinutes: number,
  notes: string | undefined,
  patientId: string,
  serviceTypeId: string,
  sessionId: string
): GoogleCalendarEvent => {
  const start = new Date(scheduledAt)
  const end = new Date(start.getTime() + durationMinutes * 60000)
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

  return {
    summary: `[${serviceName}] ${patientName}`,
    description: notes || '',
    start: { dateTime: start.toISOString(), timeZone: tz },
    end: { dateTime: end.toISOString(), timeZone: tz },
    extendedProperties: {
      private: {
        appId: 'psymanager',
        patientId,
        serviceTypeId,
        sessionId,
      },
    },
  }
}
