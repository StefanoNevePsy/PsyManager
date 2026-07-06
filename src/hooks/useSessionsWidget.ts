import { useEffect } from 'react'
import { startOfDay, endOfDay, addDays } from 'date-fns'
import { useSessions } from './useSessions'
import { usePatientBalanceMap } from './usePayments'
import { updateWidgetSessions, WidgetSessionData } from '@/lib/sessionsWidget'
import { sessionDisplayName } from '@/lib/sessionDisplay'
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

  const { data: sessions = [], isSuccess } = useSessions(today, tomorrow)
  const balanceMap = usePatientBalanceMap()

  useEffect(() => {
    // Never overwrite the widget's stored data with a transient "no data yet"
    // state: if the app closed before the query resolved, the widget would be
    // stuck showing "Nessuna seduta" until the next successful sync. Only
    // write after the query has actually SUCCEEDED (cached data counts).
    if (!user) return
    if (!isSuccess) return

    try {
      const payload: WidgetSessionData[] = sessions
        .filter((s) => s.status !== 'cancelled')
        .map((s) => ({
          id: s.id,
          scheduledAt: s.scheduled_at,
          durationMinutes: s.duration_minutes,
          patientName: sessionDisplayName(s),
          serviceName: s.service_types?.name ?? '',
          balance: balanceMap.get(s.patient_id ?? s.group_id ?? '') ?? 0,
        }))

      void updateWidgetSessions(payload)
    } catch (err) {
      console.error('[Widget] Error updating sessions:', err)
    }
  }, [user, isSuccess, sessions, balanceMap])
}
