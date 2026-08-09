import { clearToken as clearGoogleToken } from '@/lib/googleCalendar'

/**
 * Remove every device-local trace of the signed-in user.
 *
 * The persisted React Query cache keeps patients, sessions and clinical notes
 * in plaintext for 24h, and the Google Calendar token stays usable until it
 * expires — neither is cleared by Supabase's own signOut. On a shared device
 * that would leave the previous professional's clinical data reachable.
 */
export const clearLocalUserData = () => {
  try {
    clearGoogleToken()
  } catch {
    // ignore
  }

  const prefixes = [
    'psymanager-query-cache', // persisted React Query cache (all versions)
    'psymanager:gcal_',       // calendar sync token + last sync timestamp
    'psymanager:reminder_ids',
    'psymanager:series_topup_at',
  ]

  try {
    for (const key of Object.keys(localStorage)) {
      if (prefixes.some((prefix) => key.startsWith(prefix))) {
        localStorage.removeItem(key)
      }
    }
  } catch {
    // localStorage unavailable — nothing to clear
  }
}
