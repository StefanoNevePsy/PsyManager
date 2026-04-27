import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { Database } from '@/types/database'
import { generateOccurrences } from '@/lib/recurrence'
import { RecurrenceFormData } from '@/lib/schemas'

type Session = Database['public']['Tables']['sessions']['Row']
type SessionInsert = Database['public']['Tables']['sessions']['Insert']
type SessionUpdate = Database['public']['Tables']['sessions']['Update']
type SessionSeriesInsert = Database['public']['Tables']['session_series']['Insert']
type Patient = Database['public']['Tables']['patients']['Row']
type ServiceType = Database['public']['Tables']['service_types']['Row']

export type SessionWithRelations = Session & {
  patients: Patient
  service_types: ServiceType
}

export type DeleteScope = 'one' | 'this_and_following' | 'all_future'

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
        .select('*, patients(*), service_types(*)')
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
        .select('*, patients(*), service_types(*)')
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

      // Non-recurring: simple insert
      if (!recurrence || !recurrence.enabled) {
        const { data, error } = await supabase
          .from('sessions')
          .insert({ ...sessionData, user_id: user.id })
          .select('*, patients(*), service_types(*)')
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

      const seriesPayload: Omit<SessionSeriesInsert, 'user_id'> & { user_id: string } = {
        user_id: user.id,
        patient_id: sessionData.patient_id,
        service_type_id: sessionData.service_type_id,
        frequency: recurrence.frequency,
        interval_value: recurrence.interval_value,
        interval_unit: recurrence.interval_unit,
        days_of_week: recurrence.days_of_week,
        end_type: recurrence.end_type,
        end_count: recurrence.end_count ?? null,
        end_date: recurrence.end_date || null,
        start_at: sessionData.scheduled_at,
        duration_minutes: sessionData.duration_minutes,
        notes: sessionData.notes ?? null,
      }

      const { data: series, error: seriesError } = await supabase
        .from('session_series')
        .insert(seriesPayload)
        .select()
        .single()

      if (seriesError) throw seriesError

      const sessionsToInsert = occurrences.map((occurrence) => ({
        user_id: user.id,
        patient_id: sessionData.patient_id,
        service_type_id: sessionData.service_type_id,
        series_id: series.id,
        scheduled_at: occurrence.toISOString(),
        duration_minutes: sessionData.duration_minutes,
        notes: sessionData.notes,
      }))

      const { data: insertedSessions, error: sessionsError } = await supabase
        .from('sessions')
        .insert(sessionsToInsert)
        .select('*, patients(*), service_types(*)')

      if (sessionsError) throw sessionsError

      return { session: insertedSessions?.[0], occurrencesCount: occurrences.length }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
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
        .select('*, patients(*), service_types(*)')
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      queryClient.invalidateQueries({ queryKey: ['session'] })
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
      serviceTypeId,
      scheduledAt,
      durationMinutes,
      notes,
      recurrence,
    }: {
      sessionId: string
      patientId: string
      serviceTypeId: string
      scheduledAt: string
      durationMinutes: number
      notes?: string | null
      recurrence: RecurrenceFormData
    }) => {
      if (!user) throw new Error('Not authenticated')
      if (!recurrence.enabled) throw new Error('Recurrence not enabled')

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

      const seriesPayload: Omit<SessionSeriesInsert, 'user_id'> & { user_id: string } = {
        user_id: user.id,
        patient_id: patientId,
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
          service_type_id: serviceTypeId,
          scheduled_at: scheduledAt,
          duration_minutes: durationMinutes,
          notes: notes ?? undefined,
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
          service_type_id: serviceTypeId,
          series_id: series.id,
          scheduled_at: occurrence.toISOString(),
          duration_minutes: durationMinutes,
          notes: notes ?? undefined,
        }))
        const { error: insertError } = await supabase
          .from('sessions')
          .insert(sessionsToInsert)
        if (insertError) throw insertError
      }

      return { occurrencesCount: occurrences.length }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      queryClient.invalidateQueries({ queryKey: ['session'] })
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
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
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
 * - 'all_future': delete this and all future sessions in the series (alias for clarity)
 *   Past sessions (already happened) are always preserved.
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
        const { error } = await supabase.from('sessions').delete().eq('id', sessionId)
        if (error) throw error
        return { deletedCount: 1 }
      }

      // For series-aware delete, only touch future (or current) occurrences
      const now = new Date().toISOString()
      const fromDate = scope === 'all_future' ? now : scheduledAt

      const { data: deleted, error } = await supabase
        .from('sessions')
        .delete()
        .eq('series_id', seriesId)
        .gte('scheduled_at', fromDate)
        .select('id')

      if (error) throw error
      return { deletedCount: deleted?.length ?? 0 }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
    },
  })
}
