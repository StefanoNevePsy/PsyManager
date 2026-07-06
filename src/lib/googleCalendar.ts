import { Capacitor } from '@capacitor/core'
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth'

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
  // Present on events returned by events.list; 'cancelled' marks a deletion
  // (always present when using showDeleted=true or a sync token).
  status?: string
  // Cancelled events returned by Google often omit summary/start/end
  // entirely, so these are optional even though we always set them when
  // creating/updating events ourselves.
  summary?: string
  description?: string
  start?: { dateTime: string; timeZone?: string }
  end?: { dateTime: string; timeZone?: string }
  extendedProperties?: {
    private?: Record<string, string>
  }
  // Google Calendar's fixed colorId palette ('1'..'11'). Omitted when the
  // user disables per-service coloring, or for older Google API responses
  // that don't set it.
  colorId?: string
}

declare global {
  interface Window {
    google?: any
  }
}

const isNativePlatform = () => Capacitor.isNativePlatform()

export const isGoogleApiLoaded = () => {
  // On native, we don't need GIS loaded; on web, check for window.google
  return isNativePlatform() || (typeof window !== 'undefined' && !!window.google?.accounts?.oauth2)
}

export const loadGoogleApi = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // On native platform, initialize the plugin instead of loading the script
    if (isNativePlatform()) {
      const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || ''
      if (!clientId) {
        reject(new Error('Google Client ID not configured'))
        return
      }
      GoogleAuth.initialize({ clientId, scopes: [SCOPES] })
        .then(() => resolve())
        .catch((error) => reject(error))
      return
    }

    // Web: load Google Identity Services
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
const requestTokenWeb = (
  clientId: string,
  silent: boolean
): Promise<GoogleTokenInfo> => {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
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

/**
 * Native platform: request token via Capacitor plugin
 */
const requestTokenNative = async (): Promise<GoogleTokenInfo> => {
  const user = await GoogleAuth.signIn()

  if (!user.authentication?.accessToken) {
    throw new Error('Failed to get access token')
  }

  const tokenInfo: GoogleTokenInfo = {
    access_token: user.authentication.accessToken,
    // Plugin doesn't provide expiry time, so assume 1 hour
    expires_at: Date.now() + 3600 * 1000,
    scope: SCOPES,
  }
  saveToken(tokenInfo)
  return tokenInfo
}

/**
 * Silent token refresh on native: attempt to get a fresh token without UI
 */
const requestTokenNativeSilent = async (): Promise<GoogleTokenInfo> => {
  const auth = await GoogleAuth.refresh()

  if (!auth.accessToken) {
    throw new Error('Failed to refresh access token')
  }

  const tokenInfo: GoogleTokenInfo = {
    access_token: auth.accessToken,
    // Plugin doesn't provide expiry time, so assume 1 hour
    expires_at: Date.now() + 3600 * 1000,
    scope: SCOPES,
  }
  saveToken(tokenInfo)
  return tokenInfo
}

const requestToken = (
  clientId: string,
  silent: boolean
): Promise<GoogleTokenInfo> => {
  if (isNativePlatform()) {
    return silent ? requestTokenNativeSilent() : requestTokenNative()
  }
  return requestTokenWeb(clientId, silent)
}

export const requestAccessToken = (clientId: string) =>
  requestToken(clientId, false)

/**
 * Silently request a new access token without UI. Resolves with a fresh
 * token if Google still recognizes the user's session, or rejects if the
 * user needs to re-authenticate interactively.
 */
// Single-flight guard: several concurrent apiCall()s (fullSync runs batches
// of 5) can all discover an expired/expiring token at once. Without this,
// each would kick off its own silent refresh — hammering Google's endpoint
// and, on native, potentially racing the Capacitor plugin. All concurrent
// callers instead await the same in-flight promise.
let inFlightSilentRefresh: Promise<GoogleTokenInfo> | null = null

const requestAccessTokenSilentShared = (clientId: string): Promise<GoogleTokenInfo> => {
  if (!inFlightSilentRefresh) {
    inFlightSilentRefresh = requestToken(clientId, true).finally(() => {
      inFlightSilentRefresh = null
    })
  }
  return inFlightSilentRefresh
}

export const requestAccessTokenSilent = (clientId: string) =>
  requestAccessTokenSilentShared(clientId)

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

/**
 * Error raised for non-OK Google API responses, carrying the HTTP status so
 * callers can branch on specific codes (e.g. 410 GONE for expired sync
 * tokens) without parsing the error message string.
 */
export class GoogleApiHttpError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'GoogleApiHttpError'
    this.status = status
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
  // attempt one silent refresh and retry the request once. Uses the shared
  // single-flight refresh so concurrent 401s from a parallel batch don't
  // each trigger their own refresh.
  if (response.status === 401 && clientId) {
    try {
      const fresh = await requestAccessTokenSilentShared(clientId)
      response = await performFetch(path, options, fresh)
    } catch {
      // Silent refresh failed — clear token so UI shows "Reconnect"
      clearToken()
      throw new GoogleApiHttpError('Google authentication expired', 401)
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearToken()
      throw new GoogleApiHttpError('Google authentication expired', 401)
    }
    const error = await response.json().catch(() => ({}))
    throw new GoogleApiHttpError(
      error.error?.message || `Google API error: ${response.statusText}`,
      response.status
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

const SYNC_TOKEN_KEY = 'psymanager:gcal_sync_token'

const getSyncToken = (): string | null => localStorage.getItem(SYNC_TOKEN_KEY)
const saveSyncToken = (token: string) => localStorage.setItem(SYNC_TOKEN_KEY, token)
const clearSyncToken = () => localStorage.removeItem(SYNC_TOKEN_KEY)

export interface IncrementalSyncResult {
  events: GoogleCalendarEvent[]
  /** true when this was a full window fetch (no sync token available / token expired) */
  isFullSync: boolean
}

interface EventsListPage {
  items?: GoogleCalendarEvent[]
  nextPageToken?: string
  nextSyncToken?: string
}

/**
 * Follows nextPageToken across all pages of an events.list call. Google only
 * returns nextSyncToken on the LAST page (once there's no more
 * nextPageToken), so it's only captured once pagination is exhausted.
 */
const fetchAllPages = async (
  calendarId: string,
  baseParams: URLSearchParams
): Promise<{ events: GoogleCalendarEvent[]; nextSyncToken?: string }> => {
  let events: GoogleCalendarEvent[] = []
  let pageToken: string | undefined
  let nextSyncToken: string | undefined

  do {
    const params = new URLSearchParams(baseParams)
    if (pageToken) params.set('pageToken', pageToken)

    const data = await apiCall<EventsListPage>(
      `/calendars/${encodeURIComponent(calendarId)}/events?${params}`
    )

    events = events.concat(data.items || [])
    pageToken = data.nextPageToken
    if (data.nextSyncToken) nextSyncToken = data.nextSyncToken
  } while (pageToken)

  return { events, nextSyncToken }
}

/**
 * Incremental events.list using Google's sync tokens, falling back to a full
 * paginated window fetch when there's no stored token yet (or it expired).
 *
 * Google Calendar API caveats handled here:
 * - A syncToken CANNOT be combined with timeMin/timeMax/orderBy/showDeleted —
 *   those are only valid on the initial full-sync request. The incremental
 *   request passes only syncToken + pagination (singleEvents is kept since
 *   the API forbids turning off recurring-event expansion once a sync token
 *   is in play).
 * - Deleted events come back with status: 'cancelled' automatically when
 *   using a sync token (showDeleted is implied), no matter the calendar's
 *   default.
 * - If the token is too old/invalid, Google responds 410 GONE — the stored
 *   token is cleared and the call is retried once as a full sync.
 */
export const listEventsIncremental = async (
  calendarId = 'primary',
  timeMin?: Date,
  timeMax?: Date
): Promise<IncrementalSyncResult> => {
  const runFullSync = async (): Promise<IncrementalSyncResult> => {
    const params = new URLSearchParams({
      singleEvents: 'true',
      showDeleted: 'true',
      maxResults: '250',
      orderBy: 'startTime',
    })
    if (timeMin) params.set('timeMin', timeMin.toISOString())
    if (timeMax) params.set('timeMax', timeMax.toISOString())

    const { events, nextSyncToken } = await fetchAllPages(calendarId, params)
    if (nextSyncToken) saveSyncToken(nextSyncToken)
    return { events, isFullSync: true }
  }

  const storedToken = getSyncToken()
  if (!storedToken) {
    return runFullSync()
  }

  try {
    const params = new URLSearchParams({
      syncToken: storedToken,
      maxResults: '250',
      singleEvents: 'true',
    })
    const { events, nextSyncToken } = await fetchAllPages(calendarId, params)
    if (nextSyncToken) saveSyncToken(nextSyncToken)
    return { events, isFullSync: false }
  } catch (err) {
    if (err instanceof GoogleApiHttpError && err.status === 410) {
      // Sync token expired or invalid — Google requires a fresh full sync.
      clearSyncToken()
      return runFullSync()
    }
    throw err
  }
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
  displayName: string,
  serviceName: string,
  scheduledAt: string,
  durationMinutes: number,
  notes: string | null | undefined,
  patientId: string | null | undefined,
  serviceTypeId: string,
  sessionId: string,
  groupId?: string | null,
  colorId?: string | null
): GoogleCalendarEvent => {
  const start = new Date(scheduledAt)
  const end = new Date(start.getTime() + durationMinutes * 60000)
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

  // Google requires string values here — never include null/undefined keys
  const privateProps: Record<string, string> = {
    appId: 'psymanager',
    serviceTypeId,
    sessionId,
  }
  if (patientId) privateProps.patientId = patientId
  if (groupId) privateProps.groupId = groupId

  return {
    summary: `[${serviceName}] ${displayName}`,
    description: notes || '',
    start: { dateTime: start.toISOString(), timeZone: tz },
    end: { dateTime: end.toISOString(), timeZone: tz },
    extendedProperties: {
      private: privateProps,
    },
    ...(colorId ? { colorId } : {}),
  }
}
