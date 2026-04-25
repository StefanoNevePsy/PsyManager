import { useState, useCallback } from 'react'
import { useGoogleCalendarStore } from '@/stores/googleCalendarStore'
import {
  listEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  sessionToGoogleEvent,
  GoogleCalendarEvent,
} from '@/lib/googleCalendar'
import { useSessions, SessionWithRelations } from './useSessions'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from './useAuth'

export const useGoogleCalendarSync = () => {
  const { isConnected } = useGoogleCalendarStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: sessions = [] } = useSessions()
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unmappedEvents, setUnmappedEvents] = useState<GoogleCalendarEvent[]>([])

  const pushSessionToCalendar = useCallback(
    async (session: SessionWithRelations) => {
      if (!isConnected()) return null

      const patientName = `${session.patients.last_name} ${session.patients.first_name}`
      const event = sessionToGoogleEvent(
        patientName,
        session.service_types.name,
        session.scheduled_at,
        session.duration_minutes,
        session.notes,
        session.patient_id,
        session.service_type_id,
        session.id
      )

      try {
        if (session.google_calendar_event_id) {
          await updateEvent(session.google_calendar_event_id, event)
          return session.google_calendar_event_id
        } else {
          const created = await createEvent(event)
          if (created.id) {
            await supabase
              .from('sessions')
              .update({ google_calendar_event_id: created.id })
              .eq('id', session.id)
            return created.id
          }
        }
      } catch (err) {
        console.error('Failed to push session to Google Calendar:', err)
        throw err
      }
      return null
    },
    [isConnected]
  )

  const removeSessionFromCalendar = useCallback(
    async (eventId: string) => {
      if (!isConnected()) return

      try {
        await deleteEvent(eventId)
      } catch (err) {
        console.error('Failed to delete event from Google Calendar:', err)
      }
    },
    [isConnected]
  )

  const fullSync = useCallback(
    async (timeMin?: Date, timeMax?: Date) => {
      if (!isConnected() || !user) return

      setSyncing(true)
      setError(null)
      setUnmappedEvents([])

      try {
        const events = await listEvents('primary', timeMin, timeMax)

        const sessionMap = new Map(
          sessions
            .filter((s) => s.google_calendar_event_id)
            .map((s) => [s.google_calendar_event_id!, s])
        )

        const unmapped: GoogleCalendarEvent[] = []

        for (const event of events) {
          if (!event.id) continue

          const existingSession = sessionMap.get(event.id)
          const meta = event.extendedProperties?.private

          if (existingSession && event.start.dateTime) {
            const newScheduledAt = new Date(event.start.dateTime).toISOString()
            const newEnd = event.end.dateTime ? new Date(event.end.dateTime) : null
            const newDuration = newEnd
              ? Math.round(
                  (newEnd.getTime() - new Date(event.start.dateTime).getTime()) /
                    60000
                )
              : existingSession.duration_minutes

            if (
              newScheduledAt !== existingSession.scheduled_at ||
              newDuration !== existingSession.duration_minutes
            ) {
              await supabase
                .from('sessions')
                .update({
                  scheduled_at: newScheduledAt,
                  duration_minutes: newDuration,
                })
                .eq('id', existingSession.id)
            }
          } else if (meta?.appId === 'psymanager' && meta.sessionId) {
            continue
          } else if (event.start.dateTime) {
            unmapped.push(event)
          }
        }

        for (const session of sessions) {
          if (!session.google_calendar_event_id) {
            await pushSessionToCalendar(session)
          }
        }

        setUnmappedEvents(unmapped)
        queryClient.invalidateQueries({ queryKey: ['sessions'] })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Sync failed')
      } finally {
        setSyncing(false)
      }
    },
    [isConnected, user, sessions, pushSessionToCalendar, queryClient]
  )

  return {
    syncing,
    error,
    unmappedEvents,
    pushSessionToCalendar,
    removeSessionFromCalendar,
    fullSync,
  }
}
