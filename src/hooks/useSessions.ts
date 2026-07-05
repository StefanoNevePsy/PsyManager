import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { Database, SessionStatus } from '@/types/database'
import { generateOccurrences } from '@/lib/recurrence'
import { RecurrenceFormData } from '@/lib/schemas'

type Session = Database['public']['Tables']['sessions']['Row']
type SessionInsert = Database['public']['Tables']['sessions']['Insert']
type SessionUpdate = Database['public']['Tables']['sessions']['Update']
type SessionSeriesInsert = Database['public']['Tables']['session_series']['Insert']
type Patient = Database['public']['Tables']['patients']['Row']
type ServiceType = Database['public']['Tables']['service_types']['Row']
type PatientGroup = Database['public']['Tables']['patient_groups']['Row']

export type SessionWithRelations = Session & {
  // Left joins: null for group sessions (patients) / individual sessions (patient_groups)
  patients: Patient | null
  service_types: ServiceType
  patient_groups: PatientGroup | null
}

export type DeleteScope = 'one' | 'this_and_following' | 'all_future'

// Every session read joins patient, service type and group so display
// components never need extra fetches.
const SESSION_SELECT = '*, patients(*), service_types(*), patient_groups(*)'

// Sessions affect balances, dashboard KPIs and reports — invalidate them all
// so those screens never show stale money data after a change.
const invalidateSessionRelated = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: ['sessions'] })
  queryClient.invalidateQueries({ queryKey: ['session'] })
  queryClient.invalidateQueries({ queryKey: ['patient_balances'] })
  queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] })
  queryClient.invalidateQueries({ queryKey: ['reports'] })
}

export const useSessions = (startDate?: Date, endDate?: Date) => {
  const { user } = useAuth()

  return useQuery({
    queryKey: [
      'sessions',
      user?.id,
      startDate?.toISOString(),
      endDate?.toISOString(),
    ],
    queryFn: async () => {
      if (!user) return []
      let query = supabase
        .from('sessions')
        .select(SESSION_SELECT)
        .eq('user_id', user.id)
        .order('scheduled_at', { ascending: true })

      if (startDate) {
        query = query.gte('scheduled_at', startDate.toISOString())
      }
      if (endDate) {
        query = query.lte('scheduled_at', endDate.toISOString())
      }

      const { data, error } = await query
      if (error) throw error
      return data as SessionWithRelations[]
    },
    enabled: !!user,
  })
}

export const useSession = (id: string | undefined) => {
  return useQuery({
    queryKey: ['session', id],
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await supabase
        .from('sessions')
        .select(SESSION_SELECT)
        .eq('id', id)
        .single()

      if (error) throw error
      return data as SessionWithRelations
    },
    enabled: !!id,
  })
}

export const useCreateSession = () => {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (
      session: Omit<SessionInsert, 'user_id'> & { recurrence?: RecurrenceFormData }
    ) => {
      if (!user) throw new Error('Not authenticated')

      const { recurrence, ...sessionData } = session

      // Explicit nulls: undefined keys are dropped by JSON serialization,
      // which would leave stale patient_id/group_id values on the row.
      const base = {
        patient_id: sessionData.patient_id || null,
        group_id: sessionData.group_id || null,
        session_type: sessionData.session_type || 'individuale',
        service_type_id: sessionData.service_type_id,
        duration_minutes: sessionData.duration_minutes,
        notes: sessionData.notes ?? null,
      }

      // Non-recurring: simple insert
      if (!recurrence || !recurrence.enabled) {
        const { data, error } = await supabase
          .from('sessions')
          .insert({
            ...base,
            user_id: user.id,
            scheduled_at: sessionData.scheduled_at,
          })
          .select(SESSION_SELECT)
          .single()

        if (error) throw error
        return { session: data, occurrencesCount: 1 }
      }

      // Recurring: create the series, then bulk-insert occurrences
      const startAt = new Date(sessionData.scheduled_at)
      const occurrences = generateOccurrences({
        startAt,
        recurrence: {
          frequency: recurrence.frequency,
          interval_value: recurrence.interval_value,
          interval_unit: recurrence.interval_unit,
          days_of_week: recurrence.days_of_week,
          end_type: recurrence.end_type,
          end_count: recurrence.end_count,
          end_date: recurrence.end_date,
        },
      })

      if (occurrences.length === 0) throw new Error('Nessuna occorrenza generata')

      const seriesPayload: SessionSeriesInsert = {
        user_id: user.id,
        patient_id: base.patient_id,
        group_id: base.group_id,
        session_type: base.session_type,
        service_type_id: base.service_type_id,
        frequency: recurrence.frequency,
        interval_value: recurrence.interval_value,
        interval_unit: recurrence.interval_unit,
        days_of_week: recurrence.days_of_week,
        end_type: recurrence.end_type,
        end_count: recurrence.end_count ?? null,
        end_date: recurrence.end_date || null,
        start_at: sessionData.scheduled_at,
        duration_minutes: base.duration_minutes,
        notes: base.notes,
      }

      const { data: series, error: seriesError } = await supabase
        .from('session_series')
        .insert(seriesPayload)
        .select()
        .single()

      if (seriesError) throw seriesError

      const sessionsToInsert = occurrences.map((occurrence) => ({
        ...base,
        user_id: user.id,
        series_id: series.id,
        scheduled_at: occurrence.toISOString(),
      }))

      const { data: insertedSessions, error: sessionsError } = await supabase
        .from('sessions')
        .insert(sessionsToInsert)
        .select(SESSION_SELECT)

      if (sessionsError) throw sessionsError

      return { session: insertedSessions?.[0], occurrencesCount: occurrences.length }
    },
    onSuccess: () => {
      invalidateSessionRelated(queryClient)
    },
  })
}

export const useUpdateSession = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string
      updates: SessionUpdate
    }) => {
      const { data, error } = await supabase
        .from('sessions')
        .update(updates)
        .eq('id', id)
        .select(SESSION_SELECT)
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      invalidateSessionRelated(queryClient)
    },
  })
}

/** Quick status change (completed / cancelled / no-show). */
export const useUpdateSessionStatus = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: SessionStatus }) => {
      const { data, error } = await supabase
        .from('sessions')
        .update({ status })
        .eq('id', id)
        .select(SESSION_SELECT)
        .single()

      if (error) throw error
      return data as SessionWithRelations
    },
    onSuccess: () => {
      invalidateSessionRelated(queryClient)
    },
  })
}

/**
 * Convert a single existing session into a recurring series.
 *
 * Strategy: keep the original session as the FIRST occurrence (just attach the
 * new series_id to it), then bulk-insert the additional future occurrences.
 * This preserves any payments/calendar links already attached to the original.
 */
export const useConvertSessionToSeries = () => {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({
      sessionId,
      patientId,
      groupId,
      sessionType,
      serviceTypeId,
      scheduledAt,
      durationMinutes,
      notes,
      recurrence,
    }: {
      sessionId: string
      patientId: string | null
      groupId: string | null
      sessionType: 'individuale' | 'coppia' | 'familiare'
      serviceTypeId: string
      scheduledAt: string
      durationMinutes: number
      notes?: string | null
      recurrence: RecurrenceFormData
    }) => {
      if (!user) throw new Error('Not authenticated')
      if (!recurrence.enabled) throw new Error('Recurrence not enabled')
      if (!patientId && !groupId) throw new Error('Seleziona un paziente o un gruppo')

      const startAt = new Date(scheduledAt)
      const occurrences = generateOccurrences({
        startAt,
        recurrence: {
          frequency: recurrence.frequency,
          interval_value: recurrence.interval_value,
          interval_unit: recurrence.interval_unit,
          days_of_week: recurrence.days_of_week,
          end_type: recurrence.end_type,
          end_count: recurrence.end_count,
          end_date: recurrence.end_date,
        },
      })
      if (occurrences.length === 0) throw new Error('Nessuna occorrenza generata')

      const seriesPayload: SessionSeriesInsert = {
        user_id: user.id,
        patient_id: patientId,
        group_id: groupId,
        session_type: sessionType,
        service_type_id: serviceTypeId,
        frequency: recurrence.frequency,
        interval_value: recurrence.interval_value,
        interval_unit: recurrence.interval_unit,
        days_of_week: recurrence.days_of_week,
        end_type: recurrence.end_type,
        end_count: recurrence.end_count ?? null,
        end_date: recurrence.end_date || null,
        start_at: scheduledAt,
        duration_minutes: durationMinutes,
        notes: notes ?? null,
      }

      const { data: series, error: seriesError } = await supabase
        .from('session_series')
        .insert(seriesPayload)
        .select()
        .single()

      if (seriesError) throw seriesError

      // Update the original session: link it to the new series + apply edited fields
      const { error: updateError } = await supabase
        .from('sessions')
        .update({
          patient_id: patientId,
          group_id: groupId,
          session_type: sessionType,
          service_type_id: serviceTypeId,
          scheduled_at: scheduledAt,
          duration_minutes: durationMinutes,
          notes: notes ?? null,
          series_id: series.id,
        })
        .eq('id', sessionId)

      if (updateError) throw updateError

      // Skip the first occurrence (== original session) and insert the rest
      const rest = occurrences.slice(1)
      if (rest.length > 0) {
        const sessionsToInsert = rest.map((occurrence) => ({
          user_id: user.id,
          patient_id: patientId,
          group_id: groupId,
          session_type: sessionType,
          service_type_id: serviceTypeId,
          series_id: series.id,
          scheduled_at: occurrence.toISOString(),
          duration_minutes: durationMinutes,
          notes: notes ?? null,
        }))
        const { error: insertError } = await supabase
          .from('sessions')
          .insert(sessionsToInsert)
        if (insertError) throw insertError
      }

      return { occurrencesCount: occurrences.length }
    },
    onSuccess: () => {
      invalidateSessionRelated(queryClient)
    },
  })
}

export const useDeleteSession = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sessions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      invalidateSessionRelated(queryClient)
    },
  })
}

export interface DeleteSessionScopeParams {
  sessionId: string
  seriesId?: string | null
  scheduledAt: string
  scope: DeleteScope
}

/**
 * Delete a session with awareness of its series.
 * - 'one': delete only this session
 * - 'this_and_following': delete this and all future sessions in the same series
 * - 'all_future': delete the clicked session plus every future session in the
 *   series. Past sessions (already happened) are always preserved.
 */
export const useDeleteSessionScoped = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      sessionId,
      seriesId,
      scheduledAt,
      scope,
    }: DeleteSessionScopeParams) => {
      if (scope === 'one' || !seriesId) {
        const { data: one, error } = await supabase
          .from('sessions')
          .delete()
          .eq('id', sessionId)
          .select('id, google_calendar_event_id')
        if (error) throw error
        return {
          deletedCount: 1,
          deletedEventIds: (one ?? [])
            .map((d) => d.google_calendar_event_id)
            .filter((id): id is string => !!id),
        }
      }

      // For series-aware delete, only touch future (or current) occurrences
      const now = new Date().toISOString()
      const fromDate = scope === 'all_future' ? now : scheduledAt

      const { data: deleted, error } = await supabase
        .from('sessions')
        .delete()
        .eq('series_id', seriesId)
        .gte('scheduled_at', fromDate)
        .select('id, google_calendar_event_id')

      if (error) throw error

      let deletedCount = deleted?.length ?? 0
      const deletedEventIds = (deleted ?? [])
        .map((d) => d.google_calendar_event_id)
        .filter((id): id is string => !!id)

      // 'all_future' from a PAST occurrence: the clicked session itself is
      // before `now`, so the range delete above missed it. The user explicitly
      // targeted it — delete it too.
      const clickedWasDeleted = deleted?.some((d) => d.id === sessionId) ?? false
      if (scope === 'all_future' && !clickedWasDeleted) {
        const { data: one, error: oneError } = await supabase
          .from('sessions')
          .delete()
          .eq('id', sessionId)
          .select('id, google_calendar_event_id')
        if (oneError) throw oneError
        deletedCount += 1
        for (const d of one ?? []) {
          if (d.google_calendar_event_id) deletedEventIds.push(d.google_calendar_event_id)
        }
      }

      return { deletedCount, deletedEventIds }
    },
    onSuccess: () => {
      invalidateSessionRelated(queryClient)
    },
  })
}
