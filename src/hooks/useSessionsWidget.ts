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
    const payload: WidgetSessionData[] = sessions.map((s) => ({
      id: s.id,
      scheduledAt: s.scheduled_at,
      durationMinutes: s.duration_minutes,
      patientName: s.patients
        ? `${s.patients.last_name} ${s.patients.first_name}`.trim()
        : '',
      serviceName: s.service_types?.name ?? '',
      balance: balanceMap.get(s.patient_id) ?? 0,
    }))

    void updateWidgetSessions(payload)
    // We intentionally re-push whenever the underlying queries change. The
    // payload is small and the plugin is a no-op on non-Android.
  }, [sessions, balanceMap])
}
