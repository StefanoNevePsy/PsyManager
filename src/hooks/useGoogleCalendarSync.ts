import { useState, useCallback } from 'react'
import { startOfDay, endOfDay } from 'date-fns'
import { useGoogleCalendarStore } from '@/stores/googleCalendarStore'
import {
  listEventsIncremental,
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
import { calendarDisplayName } from '@/lib/sessionDisplay'
import { getGoogleColorId } from '@/lib/serviceColors'
import { useCalendarSettings, DEFAULT_CALENDAR_SETTINGS } from './useCalendarSettings'

// Sync window: ±N days from today. Limits the number of operations.
const SYNC_DAYS_PAST = 90
const SYNC_DAYS_FUTURE = 180
const PARALLEL_BATCH_SIZE = 5
const MAX_OPERATIONS = 500
const LAST_SYNC_KEY = 'psymanager:gcal_last_sync'

const readLastSync = (): number | null => {
  const raw = localStorage.getItem(LAST_SYNC_KEY)
  if (!raw) return null
  const value = Number(raw)
  return Number.isNaN(value) ? null : value
}

export const useGoogleCalendarSync = () => {
  const { isConnected } = useGoogleCalendarStore()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: calendarSettings } = useCalendarSettings()
  const titleFormat = calendarSettings?.title_format ?? DEFAULT_CALENDAR_SETTINGS.title_format
  const colorByService = calendarSettings?.color_by_service ?? DEFAULT_CALENDAR_SETTINGS.color_by_service

  // Limit the sessions we operate on to a sane window —
  // an infinite recurrence could otherwise generate thousands of sessions
  // and the loop below would never finish.
  // Day-bounded so the React Query key stays stable across renders.
  const now = new Date()
  const syncStart = startOfDay(new Date(now.getTime() - SYNC_DAYS_PAST * 24 * 60 * 60 * 1000))
  const syncEnd = endOfDay(new Date(now.getTime() + SYNC_DAYS_FUTURE * 24 * 60 * 60 * 1000))

  const { data: sessions = [] } = useSessions(syncStart, syncEnd)
  const [syncing, setSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [unmappedEvents, setUnmappedEvents] = useState<GoogleCalendarEvent[]>([])
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(() => readLastSync())

  const pushSessionToCalendar = useCallback(
    async (session: SessionWithRelations) => {
      if (!isConnected()) return null

      // Group-aware, privacy-formatted title (group sessions have patients === null)
      const event = sessionToGoogleEvent(
        calendarDisplayName(session, titleFormat),
        session.service_types.name,
        session.scheduled_at,
        session.duration_minutes,
        session.notes,
        session.patient_id,
        session.service_type_id,
        session.id,
        session.group_id,
        colorByService ? getGoogleColorId(session.service_type_id, session.service_types?.color) : null
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
    [isConnected, titleFormat, colorByService]
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
        // Incremental when we have a sync token from a previous run; a full
        // paginated window fetch otherwise (or after a 410 forces a reset).
        const { events, isFullSync } = await listEventsIncremental(
          'primary',
          syncStart,
          syncEnd
        )

        const sessionMap = new Map(
          sessions
            .filter((s) => s.google_calendar_event_id)
            .map((s) => [s.google_calendar_event_id!, s])
        )

        const unmapped: GoogleCalendarEvent[] = []
        // Sessions whose linked Google event has drifted from the app's
        // version (edited directly on Google) — the app is the single
        // source of truth, so these get pushed again below to overwrite
        // the drift rather than being absorbed into Supabase.
        const sessionsToReenforce: SessionWithRelations[] = []
        // Sessions whose linked Google event was explicitly reported
        // cancelled/deleted in this batch — app is source of truth, so we
        // clear the link and re-push them below.
        const cancelledEventSessionIds = new Set<string>()

        for (const event of events) {
          if (!event.id) continue

          const existingSession = sessionMap.get(event.id)

          if (event.status === 'cancelled') {
            if (existingSession) {
              cancelledEventSessionIds.add(existingSession.id)
            }
            continue
          }

          const meta = event.extendedProperties?.private

          if (existingSession && event.start?.dateTime) {
            const eventScheduledAt = new Date(event.start.dateTime).toISOString()
            const eventEnd = event.end?.dateTime ? new Date(event.end.dateTime) : null
            const eventDuration = eventEnd
              ? Math.round(
                  (eventEnd.getTime() - new Date(event.start.dateTime).getTime()) /
                    60000
                )
              : existingSession.duration_minutes
            const expectedTitle = `[${existingSession.service_types.name}] ${calendarDisplayName(existingSession, titleFormat)}`

            if (
              eventScheduledAt !== new Date(existingSession.scheduled_at).toISOString() ||
              eventDuration !== existingSession.duration_minutes ||
              event.summary !== expectedTitle
            ) {
              sessionsToReenforce.push(existingSession)
            }
          } else if (meta?.appId === 'psymanager' && meta.sessionId) {
            // Already known — skip
            continue
          } else if (event.start?.dateTime) {
            unmapped.push(event)
          }
        }

        // Sessions whose google_calendar_event_id needs clearing (so the
        // push step below re-creates the event). Populated differently
        // depending on sync mode:
        let clearedIds = new Set<string>()

        if (isFullSync) {
          // Full window fetched — absence from the list means the event was
          // truly deleted on Google (dangling reference), not just unchanged.
          // This detection only makes sense against a complete window; an
          // incremental delta only contains what changed, so a missing id
          // there says nothing about whether the event still exists.
          const fetchedEventIds = new Set(events.map((e) => e.id).filter(Boolean))
          const danglingSessions = sessions.filter(
            (s) =>
              s.google_calendar_event_id &&
              !fetchedEventIds.has(s.google_calendar_event_id) &&
              new Date(s.scheduled_at) >= syncStart &&
              new Date(s.scheduled_at) <= syncEnd
          )
          if (danglingSessions.length > 0) {
            await runInBatches(danglingSessions, async (s) => {
              await supabase
                .from('sessions')
                .update({ google_calendar_event_id: null })
                .eq('id', s.id)
            })
          }
          clearedIds = new Set(danglingSessions.map((s) => s.id))
        } else if (cancelledEventSessionIds.size > 0) {
          // Incremental — only clear ids for events explicitly reported as
          // cancelled in this delta.
          await runInBatches(Array.from(cancelledEventSessionIds), async (id) => {
            await supabase
              .from('sessions')
              .update({ google_calendar_event_id: null })
              .eq('id', id)
          })
          clearedIds = cancelledEventSessionIds
        }

        // Cancelled local sessions must never be pushed. If one still has a
        // linked event (and wasn't already cleared above), remove the
        // Google event and drop the link instead of re-creating it.
        const cancelledWithEvent = sessions.filter(
          (s) =>
            s.status === 'cancelled' &&
            s.google_calendar_event_id &&
            !clearedIds.has(s.id)
        )
        if (cancelledWithEvent.length > 0) {
          await runInBatches(cancelledWithEvent, async (s) => {
            await removeSessionFromCalendar(s.google_calendar_event_id!)
            await supabase
              .from('sessions')
              .update({ google_calendar_event_id: null })
              .eq('id', s.id)
          })
        }

        // Find sessions that need to be pushed: no google_calendar_event_id
        // yet, or whose Google event was just cleared above — excluding
        // cancelled sessions, which are never pushed.
        const basePush = sessions
          .filter((s) => s.status !== 'cancelled')
          .filter((s) => !s.google_calendar_event_id || clearedIds.has(s.id))
          .map((s) =>
            clearedIds.has(s.id) ? { ...s, google_calendar_event_id: undefined } : s
          )

        // Union with drifted, still-linked sessions detected above (mirror
        // enforcement) — disjoint from basePush by construction (those
        // require a missing/cleared link, these require a live one).
        const reenforcePush = sessionsToReenforce.filter(
          (s) => s.status !== 'cancelled' && !clearedIds.has(s.id)
        )

        const pushMap = new Map<string, SessionWithRelations>()
        for (const s of [...basePush, ...reenforcePush]) {
          pushMap.set(s.id, s)
        }
        const sessionsToPush = Array.from(pushMap.values())

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

        localStorage.setItem(LAST_SYNC_KEY, String(Date.now()))
        setLastSyncAt(readLastSync())
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Sync failed')
      } finally {
        setSyncing(false)
        setSyncProgress(null)
      }
    },
    [isConnected, user, sessions, pushSessionToCalendar, removeSessionFromCalendar, queryClient, syncStart, syncEnd, titleFormat]
  )

  /**
   * Re-pushes EVERY non-cancelled session in the sync window through
   * pushSessionToCalendar — linked sessions get updateEvent (refreshing
   * title format/colors after a settings change), unlinked ones get
   * created. Used by the "apply retroactively" action in the calendar
   * settings UI after the user changes title format or coloring.
   */
  const repushAll = useCallback(async (): Promise<number> => {
    if (!isConnected() || !user || syncing) return 0

    setSyncing(true)
    setError(null)

    try {
      const sessionsToRepush = sessions.filter((s) => s.status !== 'cancelled')

      if (sessionsToRepush.length > MAX_OPERATIONS) {
        throw new Error(
          `Troppe sedute da aggiornare (${sessionsToRepush.length}). Limita la ricorrenza o aumenta il limite manualmente.`
        )
      }

      setSyncProgress({ current: 0, total: sessionsToRepush.length })

      await runInBatches(
        sessionsToRepush,
        (session) => pushSessionToCalendar(session),
        (done, total) => setSyncProgress({ current: done, total })
      )

      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      localStorage.setItem(LAST_SYNC_KEY, String(Date.now()))
      setLastSyncAt(readLastSync())

      return sessionsToRepush.length
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aggiornamento fallito')
      return 0
    } finally {
      setSyncing(false)
      setSyncProgress(null)
    }
  }, [isConnected, user, syncing, sessions, pushSessionToCalendar, queryClient])

  return {
    syncing,
    syncProgress,
    error,
    unmappedEvents,
    lastSyncAt,
    pushSessionToCalendar,
    removeSessionFromCalendar,
    fullSync,
    repushAll,
  }
}
