import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { addDays } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { generateOccurrences } from '@/lib/recurrence'
import { useAuth } from './useAuth'

// Keep never-ending series materialized at least this far ahead
const HORIZON_DAYS = 120
// At most this many new occurrences per series per run (safety valve)
const MAX_TOPUP_PER_SERIES = 60
// Run at most once a day
const CHECK_KEY = 'psymanager:series_topup_at'

/**
 * Never-ending recurring series ("a tempo indeterminato") are materialized as
 * individual session rows, initially capped at ~156 occurrences. Without a
 * top-up they would silently run dry after ~3 years. This hook runs once a
 * day and extends every open series to a rolling {@link HORIZON_DAYS}-day
 * horizon.
 *
 * A series whose future occurrences were deleted by the user is closed
 * (end_type='until') by useDeleteSessionScoped, so it is never regenerated.
 */
export const useSeriesMaintenance = () => {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!user) return

    const last = Number(localStorage.getItem(CHECK_KEY) || 0)
    if (Date.now() - last < 24 * 60 * 60 * 1000) return

    let cancelled = false

    ;(async () => {
      try {
        const { data: series, error } = await supabase
          .from('session_series')
          .select('*')
          .eq('user_id', user.id)
          .eq('end_type', 'never')
        if (error) throw error

        const horizon = addDays(new Date(), HORIZON_DAYS)
        let inserted = 0

        for (const s of series ?? []) {
          if (cancelled) return

          // Latest materialized occurrence of this series
          const { data: lastRows, error: lastError } = await supabase
            .from('sessions')
            .select('scheduled_at')
            .eq('series_id', s.id)
            .order('scheduled_at', { ascending: false })
            .limit(1)
          if (lastError) throw lastError

          const lastAt = lastRows?.[0]?.scheduled_at
          // A series with no sessions at all was emptied deliberately —
          // never resurrect it.
          if (!lastAt) continue

          const lastDate = new Date(lastAt)
          if (lastDate >= horizon) continue

          const occurrences = generateOccurrences({
            startAt: new Date(s.start_at),
            recurrence: {
              frequency: s.frequency,
              interval_value: s.interval_value,
              interval_unit: s.interval_unit,
              days_of_week: s.days_of_week ?? [],
              end_type: 'never',
              end_count: undefined,
              end_date: undefined,
            },
            until: horizon,
          })
            .filter((d) => d.getTime() > lastDate.getTime())
            .slice(0, MAX_TOPUP_PER_SERIES)

          if (occurrences.length === 0) continue

          const rows = occurrences.map((d) => ({
            user_id: user.id,
            patient_id: s.patient_id,
            group_id: s.group_id,
            session_type: s.session_type ?? 'individuale',
            service_type_id: s.service_type_id,
            series_id: s.id,
            scheduled_at: d.toISOString(),
            duration_minutes: s.duration_minutes,
            notes: s.notes,
          }))

          const { error: insertError } = await supabase.from('sessions').insert(rows)
          if (insertError) throw insertError
          inserted += rows.length
        }

        localStorage.setItem(CHECK_KEY, String(Date.now()))
        if (inserted > 0) {
          console.info(`[series] extended recurring series with ${inserted} sessions`)
          queryClient.invalidateQueries({ queryKey: ['sessions'] })
        }
      } catch (err) {
        // Never block the app on maintenance; retry on next launch
        console.warn('[series] top-up failed', err)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user, queryClient])
}
