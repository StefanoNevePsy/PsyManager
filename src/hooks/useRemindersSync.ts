import { useEffect } from 'react'
import { addDays } from 'date-fns'
import { useSessions } from './useSessions'
import { useReminderSettings } from './useReminderSettings'
import { syncReminders } from '@/lib/reminders'

/**
 * Keeps Android local notifications aligned with the user's upcoming sessions
 * and reminder preferences. No-op on web.
 */
export const useRemindersSync = () => {
  // Look 30 days ahead — same horizon as the scheduling layer
  const start = new Date()
  const end = addDays(start, 30)

  const { data: sessions = [] } = useSessions(start, end)
  const { data: settings } = useReminderSettings()

  useEffect(() => {
    // Defensive: never let reminder sync errors crash the app
    syncReminders(sessions, settings ?? null).catch(() => {
      // ignore
    })
  }, [sessions, settings])
}
