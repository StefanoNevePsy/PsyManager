import { useEffect } from 'react'
import { startOfDay, endOfDay, addDays } from 'date-fns'
import { useSessions } from './useSessions'
import { usePatientBalanceMap } from './usePayments'
import { updateWidgetSessions, WidgetSessionData } from '@/lib/sessionsWidget'
import { useAuth } from './useAuth'

/**
 * Keeps the Android home-screen widget in sync with today's sessions and the
 * current per-patient balance. Runs only on native Android — no-op elsewhere.
 *
 * The widget renders only "today" but we push a 2-day window so that around
 * midnight the widget can roll over without needing a new push.
 */
export const useSessionsWidget = () => {
  const { user } = useAuth()
  const today = startOfDay(new Date())
  const tomorrow = endOfDay(addDays(today, 1))

  const { data: sessions = [] } = useSessions(today, tomorrow)
  const balanceMap = usePatientBalanceMap()

  useEffect(() => {
    // Only update widget once user is authenticated and data is loaded
    if (!user) return

    try {
      const payload: WidgetSessionData[] = sessions.map((s) => {
        // Group sessions: show "Coppia" or "Famiglia" instead of patient name
        let displayName = ''
        if (s.group_id) {
          displayName =
            s.session_type === 'coppia'
              ? 'Seduta di Coppia'
              : s.session_type === 'familiare'
                ? 'Seduta Familiare'
                : 'Seduta di Gruppo'
        } else if (s.patients) {
          const last = s.patients.last_name ?? ''
          const first = s.patients.first_name ?? ''
          displayName = `${last} ${first}`.trim()
        }

        return {
          id: s.id,
          scheduledAt: s.scheduled_at,
          durationMinutes: s.duration_minutes,
          patientName: displayName,
          serviceName: s.service_types?.name ?? '',
          balance: s.patient_id ? (balanceMap.get(s.patient_id) ?? 0) : 0,
        }
      })

      void updateWidgetSessions(payload)
    } catch (err) {
      // Log errors for debugging but don't crash
      console.error('[Widget] Error updating sessions:', err)
    }
  }, [user, sessions, balanceMap])
}
