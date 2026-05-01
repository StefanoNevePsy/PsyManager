import { useEffect } from 'react'
import { startOfDay, endOfDay, addDays } from 'date-fns'
import { useSessions } from './useSessions'
import { usePatientBalanceMap } from './usePayments'
import { updateWidgetSessions, WidgetSessionData } from '@/lib/sessionsWidget'

/**
 * Keeps the Android home-screen widget in sync with today's sessions and the
 * current per-patient balance. Runs only on native Android — no-op elsewhere.
 *
 * The widget renders only "today" but we push a 2-day window so that around
 * midnight the widget can roll over without needing a new push.
 */
export const useSessionsWidget = () => {
  const today = startOfDay(new Date())
  const tomorrow = endOfDay(addDays(today, 1))

  const { data: sessions = [] } = useSessions(today, tomorrow)
  const balanceMap = usePatientBalanceMap()

  useEffect(() => {
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
    } catch {
      // Defensive: never let widget sync crash the app
    }
    // We intentionally re-push whenever the underlying queries change. The
    // payload is small and the plugin is a no-op on non-Android.
  }, [sessions, balanceMap])
}
