import { Database, SessionStatus, CalendarTitleFormat } from '@/types/database'

type Patient = Database['public']['Tables']['patients']['Row']
type PatientGroup = Database['public']['Tables']['patient_groups']['Row']

interface SessionLike {
  group_id?: string | null
  session_type?: 'individuale' | 'coppia' | 'familiare'
  patients?: Patient | null
  patient_groups?: PatientGroup | null
}

/** Null-safe "Cognome Nome" (last name is optional). */
export const patientFullName = (
  p: { first_name?: string | null; last_name?: string | null } | null | undefined
): string => {
  if (!p) return ''
  const last = p.last_name ?? ''
  const first = p.first_name ?? ''
  return `${last} ${first}`.trim()
}

/** Short label for the session type ("Coppia", "Famiglia"). */
export const sessionTypeLabel = (
  sessionType?: 'individuale' | 'coppia' | 'familiare'
): string => {
  switch (sessionType) {
    case 'coppia':
      return 'Coppia'
    case 'familiare':
      return 'Famiglia'
    default:
      return ''
  }
}

/**
 * The display name for a session: the patient's name for individual
 * sessions, the group's name (with type) for couple/family sessions.
 */
export const sessionDisplayName = (session: SessionLike): string => {
  if (session.group_id) {
    const groupName = session.patient_groups?.name
    const typeLabel = sessionTypeLabel(session.session_type)
    if (groupName) {
      return typeLabel ? `${groupName} (${typeLabel})` : groupName
    }
    return session.session_type === 'coppia'
      ? 'Seduta di Coppia'
      : session.session_type === 'familiare'
        ? 'Seduta Familiare'
        : 'Seduta di Gruppo'
  }
  return patientFullName(session.patients) || 'Paziente'
}

/** Compact name for tight spaces (calendar cells, widget rows). */
export const sessionShortName = (session: SessionLike): string => {
  if (session.group_id) {
    return session.patient_groups?.name || sessionTypeLabel(session.session_type) || 'Gruppo'
  }
  return session.patients?.last_name || session.patients?.first_name || 'Paziente'
}

/** Initials of every word in a name: "Rossi-Bianchi" → "R.B." */
const initialsOf = (name: string): string =>
  name
    .split(/[\s\-']+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + '.')
    .join('')

/**
 * Session name for GOOGLE CALENDAR event titles, with configurable privacy.
 * Patient names are clinical data landing on Google's servers — the
 * censored formats keep them recognizable at a glance without exposing them.
 *
 * - 'full':          "Rossi Mario"     / "Rossi-Bianchi (Coppia)"
 * - 'first_initial': "Mario R."        / "Coppia R.B."
 * - 'initials':      "M.R."            / "Coppia R.B."
 */
export const calendarDisplayName = (
  session: SessionLike,
  format: CalendarTitleFormat
): string => {
  if (format === 'full') return sessionDisplayName(session)

  if (session.group_id) {
    const typeLabel = sessionTypeLabel(session.session_type) || 'Gruppo'
    const groupName = session.patient_groups?.name
    return groupName ? `${typeLabel} ${initialsOf(groupName)}` : typeLabel
  }

  const first = session.patients?.first_name ?? ''
  const last = session.patients?.last_name ?? ''
  if (!first && !last) return 'Seduta'

  if (format === 'first_initial') {
    const lastInitial = last ? ` ${last[0].toUpperCase()}.` : ''
    return first ? `${first}${lastInitial}` : initialsOf(last)
  }

  // 'initials'
  const fi = first ? first[0].toUpperCase() + '.' : ''
  const li = last ? last[0].toUpperCase() + '.' : ''
  return `${fi}${li}` || 'Seduta'
}

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  scheduled: 'Programmata',
  completed: 'Completata',
  cancelled: 'Annullata',
  no_show: 'Assente',
}

/** Cancelled and no-show sessions are excluded from billing. */
export const isBillableStatus = (status?: SessionStatus | null): boolean =>
  status !== 'cancelled' && status !== 'no_show'
