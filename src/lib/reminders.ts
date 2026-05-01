import { Capacitor } from '@capacitor/core'
import { LocalNotifications, ScheduleOptions } from '@capacitor/local-notifications'
import { ReminderSettings } from '@/hooks/useReminderSettings'
import { SessionWithRelations } from '@/hooks/useSessions'

const isSupported = () => Capacitor.isNativePlatform()

// Window of sessions we keep scheduled. Anything beyond is rescheduled later.
const HORIZON_DAYS = 30
// Cap to stay well below Android's per-app notification limit
const MAX_NOTIFICATIONS = 60

/**
 * Compute a stable positive 31-bit integer from a string. Used as the
 * notification id so we can later cancel/reschedule the same notification
 * deterministically.
 */
const hashId = (s: string): number => {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i)
    h |= 0 // force 32-bit
  }
  // Map to positive 31-bit range to keep Android happy
  return Math.abs(h) % 2_000_000_000
}

const preNotificationId = (sessionId: string) => hashId(`pre:${sessionId}`)
const postNotificationId = (sessionId: string) => hashId(`post:${sessionId}`)

interface PendingReminder {
  id: number
  title: string
  body: string
  at: Date
  sessionId: string
  kind: 'pre' | 'post'
}

const buildPendingReminders = (
  sessions: SessionWithRelations[],
  settings: ReminderSettings | null
): PendingReminder[] => {
  if (!settings) return []
  const now = Date.now()
  const horizon = now + HORIZON_DAYS * 24 * 60 * 60 * 1000
  const reminders: PendingReminder[] = []

  for (const s of sessions) {
    const start = new Date(s.scheduled_at).getTime()
    const end = start + s.duration_minutes * 60_000

    // Build a human-readable label for the notification.
    // Group sessions show "Seduta di Coppia"/"Familiare" instead of a name.
    let patient: string
    if (s.group_id) {
      patient =
        s.session_type === 'coppia'
          ? 'Seduta di Coppia'
          : s.session_type === 'familiare'
            ? 'Seduta Familiare'
            : 'Seduta di Gruppo'
    } else if (s.patients) {
      const last = s.patients.last_name ?? ''
      const first = s.patients.first_name ?? ''
      patient = `${last} ${first}`.trim() || 'Paziente'
    } else {
      patient = 'Paziente'
    }

    const service = s.service_types?.name ?? ''

    if (settings.pre_session_enabled) {
      const triggerAt = start - settings.pre_session_minutes * 60_000
      if (triggerAt > now && triggerAt < horizon) {
        const minutes = settings.pre_session_minutes
        const label =
          minutes >= 1440
            ? `domani alle ${formatTime(start)}`
            : minutes >= 60
            ? `tra ${Math.round(minutes / 60)} h`
            : `tra ${minutes} min`
        reminders.push({
          id: preNotificationId(s.id),
          title: `Seduta ${label}`,
          body: `${patient}${service ? ' · ' + service : ''}`,
          at: new Date(triggerAt),
          sessionId: s.id,
          kind: 'pre',
        })
      }
    }

    if (settings.post_session_enabled && s.service_types?.type === 'private') {
      const triggerAt = end + settings.post_session_minutes * 60_000
      if (triggerAt > now && triggerAt < horizon) {
        reminders.push({
          id: postNotificationId(s.id),
          title: 'Registra il pagamento',
          body: `${patient}${service ? ' · ' + service : ''}`,
          at: new Date(triggerAt),
          sessionId: s.id,
          kind: 'post',
        })
      }
    }
  }

  // Sort by trigger time and cap to MAX_NOTIFICATIONS
  reminders.sort((a, b) => a.at.getTime() - b.at.getTime())
  return reminders.slice(0, MAX_NOTIFICATIONS)
}

const formatTime = (ms: number) => {
  const d = new Date(ms)
  return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Ensure notification permission is granted (Android 13+). Returns true if
 * granted (or implicit on older Android), false otherwise. Safe to call
 * multiple times.
 */
export const ensureNotificationPermission = async (): Promise<boolean> => {
  if (!isSupported()) return false
  try {
    const status = await LocalNotifications.checkPermissions()
    if (status.display === 'granted') return true
    const requested = await LocalNotifications.requestPermissions()
    return requested.display === 'granted'
  } catch {
    return false
  }
}

/**
 * Reconcile scheduled notifications with the desired set: cancel anything
 * that's no longer needed, then schedule the rest. Idempotent.
 */
export const syncReminders = async (
  sessions: SessionWithRelations[],
  settings: ReminderSettings | null
) => {
  if (!isSupported()) return

  // No settings yet, or both reminders disabled → cancel all of ours
  const allDisabled =
    !settings ||
    (!settings.pre_session_enabled && !settings.post_session_enabled)

  let pending: { notifications: { id: number }[] }
  try {
    pending = await LocalNotifications.getPending()
  } catch {
    return
  }

  const desired = allDisabled ? [] : buildPendingReminders(sessions, settings)
  const desiredIds = new Set(desired.map((r) => r.id))

  // Cancel any pending notification that's not in the desired set. We can't
  // easily distinguish "ours" from notifications scheduled by other code, so
  // we cancel only IDs that look like ours: anything that was scheduled by
  // a previous syncReminders call. To track that, we keep a list in
  // localStorage of the IDs we've ever scheduled.
  const ours = loadOwnedIds()
  const toCancel = Array.from(ours).filter((id) => !desiredIds.has(id))
  if (toCancel.length > 0) {
    try {
      await LocalNotifications.cancel({
        notifications: toCancel.map((id) => ({ id })),
      })
    } catch {
      // ignore
    }
  }

  // Schedule what we want. Skip ids that are already pending and unchanged.
  const pendingIds = new Set(pending.notifications.map((n) => n.id))
  const toSchedule = desired.filter((r) => !pendingIds.has(r.id))

  if (toSchedule.length > 0) {
    const opts: ScheduleOptions = {
      notifications: toSchedule.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        schedule: { at: r.at, allowWhileIdle: true },
        smallIcon: 'ic_notification',
        extra: { sessionId: r.sessionId, kind: r.kind },
      })),
    }
    try {
      await LocalNotifications.schedule(opts)
    } catch {
      // ignore — most likely permission denied
    }
  }

  // Persist the set of IDs we now own so the next reconciliation can clean up
  saveOwnedIds(desiredIds)
}

/**
 * Cancel every reminder we've ever scheduled. Called on logout.
 */
export const clearAllReminders = async () => {
  if (!isSupported()) return
  const ours = loadOwnedIds()
  if (ours.size === 0) return
  try {
    await LocalNotifications.cancel({
      notifications: Array.from(ours).map((id) => ({ id })),
    })
  } catch {
    // ignore
  }
  saveOwnedIds(new Set())
}

const STORAGE_KEY = 'psymanager:reminder_ids'

const loadOwnedIds = (): Set<number> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as number[]
    return new Set(parsed)
  } catch {
    return new Set()
  }
}

const saveOwnedIds = (ids: Set<number>) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)))
  } catch {
    // ignore quota errors
  }
}
