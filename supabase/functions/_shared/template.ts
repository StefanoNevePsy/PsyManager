// Placeholder renderer and Italian phone normalizer for reminder messages.
//
// This is a Deno port of src/lib/whatsapp.ts (renderTemplate / normalizePhone).
// Keep the placeholder set and the phone logic IDENTICAL to that file — the
// same {templates} are edited by the user in the app UI (WhatsApp settings)
// and reused here for SMS, so a drift here silently breaks the SMS preview
// the user thinks they configured.
//
// date-fns is a browser dependency; the edge runtime formats dates with the
// platform's Intl.DateTimeFormat instead (no extra dependency to bundle).

const ROME_TZ = 'Europe/Rome'

/** Minimal shape of a session row (as selected from Supabase) needed to render a template. */
export interface TemplateSession {
  scheduled_at: string
  duration_minutes: number
  group_id?: string | null
  session_type?: 'individuale' | 'coppia' | 'familiare' | null
  patients?: {
    first_name?: string | null
    last_name?: string | null
  } | null
  patient_groups?: {
    name?: string | null
  } | null
  service_types?: {
    name?: string | null
  } | null
}

const patientFullName = (p: { first_name?: string | null; last_name?: string | null } | null | undefined): string => {
  if (!p) return ''
  const last = p.last_name ?? ''
  const first = p.first_name ?? ''
  return `${last} ${first}`.trim()
}

const sessionTypeLabel = (sessionType?: 'individuale' | 'coppia' | 'familiare' | null): string => {
  switch (sessionType) {
    case 'coppia':
      return 'Coppia'
    case 'familiare':
      return 'Famiglia'
    default:
      return ''
  }
}

/** Mirrors sessionDisplayName from src/lib/sessionDisplay.ts. */
const sessionDisplayName = (session: TemplateSession): string => {
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

const formatRome = (date: Date, options: Intl.DateTimeFormatOptions): string =>
  new Intl.DateTimeFormat('it-IT', { ...options, timeZone: ROME_TZ }).format(date)

/**
 * Fill the template placeholders with the session's data.
 * Placeholder set MUST match src/lib/whatsapp.ts's TEMPLATE_VARIABLES exactly:
 * {nome} {cognome} {nome_completo} {giorno} {giorno_settimana} {data} {ora}
 * {durata} {prestazione}
 */
export const renderTemplate = (template: string, session: TemplateSession): string => {
  const start = new Date(session.scheduled_at)
  const isGroup = !!session.group_id
  const first = session.patients?.first_name ?? ''
  const last = session.patients?.last_name ?? ''
  const groupName = session.patient_groups?.name ?? ''

  // it-IT weekday/month names come out lowercase already, matching the
  // date-fns + `it` locale output used client-side (e.g. "lunedì 4 agosto").
  const giorno = formatRome(start, { weekday: 'long', day: 'numeric', month: 'long' })
  const giornoSettimana = formatRome(start, { weekday: 'long' })
  const data = formatRome(start, { day: '2-digit', month: '2-digit', year: 'numeric' })
  const ora = formatRome(start, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

  const values: Record<string, string> = {
    '{nome}': isGroup ? groupName : first,
    '{cognome}': isGroup ? '' : last,
    '{nome_completo}': sessionDisplayName(session),
    '{giorno}': giorno,
    '{giorno_settimana}': giornoSettimana,
    '{data}': data,
    '{ora}': ora,
    '{durata}': `${session.duration_minutes} minuti`,
    '{prestazione}': session.service_types?.name ?? '',
  }

  return Object.entries(values)
    .reduce((acc, [k, v]) => acc.split(k).join(v), template)
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

/**
 * Normalize an Italian phone number to the international format the SMS
 * provider expects (digits only, country code, no '+').
 * Returns null when the number can't be used.
 *
 * Identical logic to src/lib/whatsapp.ts's normalizePhone — kept as a
 * verbatim port rather than a shared import because this runs in Deno,
 * not Node/Vite, and the two runtimes cannot share a module file.
 */
export const normalizePhone = (raw: string | null | undefined): string | null => {
  if (!raw) return null
  let n = raw.replace(/[^\d+]/g, '')
  if (!n) return null

  if (n.startsWith('00')) n = '+' + n.slice(2)
  if (n.startsWith('+')) return n.slice(1) || null

  // Bare national number: assume Italy
  if (n.startsWith('39') && n.length >= 11) return n
  return '39' + n
}
