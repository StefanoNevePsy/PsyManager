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

// Sync window: ±N days from today. Limits the number of operations.
const SYNC_DAYS_PAST = 90
const SYNC_DAYS_FUTURE = 180
const PARALLEL_BATCH_SIZE = 5
const MAX_OPERATIONS = 500

export const useGoogleCalendarSync = () => {
  const { isConnected } = useGoogleCalendarStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  // Limit the sessions we operate on to a sane window —
  // an infinite recurrence could otherwise generate thousands of sessions
  // and the loop below would never finish.
  const syncStart = new Date()
  syncStart.setDate(syncStart.getDate() - SYNC_DAYS_PAST)
  const syncEnd = new Date()
  syncEnd.setDate(syncEnd.getDate() + SYNC_DAYS_FUTURE)

  const { data: sessions = [] } = useSessions(syncStart, syncEnd)
  const [syncing, setSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null)
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

  /**
   * Run async operations in batches of PARALLEL_BATCH_SIZE for throughput
   * without overwhelming the Google Calendar API rate limits.
   */
  const runInBatches = async <T,>(
    items: T[],
    op: (item: T) => Promise<unknown>,
    onProgress?: (done: number, total: number) => void
  ) => {
    let done = 0
    for (let i = 0; i < items.length; i += PARALLEL_BATCH_SIZE) {
      const batch = items.slice(i, i + PARALLEL_BATCH_SIZE)
      await Promise.allSettled(batch.map(op))
      done += batch.length
      onProgress?.(done, items.length)
    }
  }

  const fullSync = useCallback(
    async () => {
      if (!isConnected() || !user) return

      setSyncing(true)
      setError(null)
      setUnmappedEvents([])
      setSyncProgress({ current: 0, total: 0 })

      try {
        // Use the same window for Google events
        const events = await listEvents('primary', syncStart, syncEnd)

        const sessionMap = new Map(
          sessions
            .filter((s) => s.google_calendar_event_id)
            .map((s) => [s.google_calendar_event_id!, s])
        )

        const unmapped: GoogleCalendarEvent[] = []
        const sessionsToUpdate: Array<{ id: string; scheduled_at: string; duration_minutes: number }> = []

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
              sessionsToUpdate.push({
                id: existingSession.id,
                scheduled_at: newScheduledAt,
                duration_minutes: newDuration,
              })
            }
          } else if (meta?.appId === 'psymanager' && meta.sessionId) {
            // Already known — skip
            continue
          } else if (event.start.dateTime) {
            unmapped.push(event)
          }
        }

        // Apply pulled changes to Supabase in parallel
        if (sessionsToUpdate.length > 0) {
          await runInBatches(sessionsToUpdate, async (s) => {
            await supabase
              .from('sessions')
              .update({
                scheduled_at: s.scheduled_at,
                duration_minutes: s.duration_minutes,
              })
              .eq('id', s.id)
          })
        }

        // Find sessions that need to be pushed (no google_calendar_event_id yet)
        const sessionsToPush = sessions.filter((s) => !s.google_calendar_event_id)

        if (sessionsToPush.length > MAX_OPERATIONS) {
          throw new Error(
            `Troppe sedute da sincronizzare (${sessionsToPush.length}). Limita la ricorrenza o aumenta il limite manualmente.`
          )
        }

        setSyncProgress({ current: 0, total: sessionsToPush.length })

        await runInBatches(
          sessionsToPush,
          (session) => pushSessionToCalendar(session),
          (done, total) => setSyncProgress({ current: done, total })
        )

        setUnmappedEvents(unmapped)
        queryClient.invalidateQueries({ queryKey: ['sessions'] })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Sync failed')
      } finally {
        setSyncing(false)
        setSyncProgress(null)
      }
    },
    [isConnected, user, sessions, pushSessionToCalendar, queryClient, syncStart, syncEnd]
  )

  return {
    syncing,
    syncProgress,
    error,
    unmappedEvents,
    pushSessionToCalendar,
    removeSessionFromCalendar,
    fullSync,
  }
}
