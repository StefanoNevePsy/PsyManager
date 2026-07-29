import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { SessionWithRelations } from '@/hooks/useSessions'
import { sessionDisplayName } from '@/lib/sessionDisplay'

/** Placeholders usable in the reminder template, shown as chips in the UI. */
export const TEMPLATE_VARIABLES = [
  { key: '{nome}', label: 'Nome', hint: 'Nome del paziente (o del gruppo)' },
  { key: '{cognome}', label: 'Cognome', hint: 'Cognome del paziente' },
  { key: '{nome_completo}', label: 'Nome completo', hint: 'Nome e cognome' },
  { key: '{giorno}', label: 'Giorno', hint: 'es. lunedì 4 agosto' },
  { key: '{giorno_settimana}', label: 'Giorno sett.', hint: 'es. lunedì' },
  { key: '{data}', label: 'Data', hint: 'es. 04/08/2026' },
  { key: '{ora}', label: 'Ora', hint: 'es. 15:30' },
  { key: '{durata}', label: 'Durata', hint: 'es. 60 minuti' },
  { key: '{prestazione}', label: 'Prestazione', hint: 'Tipo di prestazione' },
] as const

export const DEFAULT_WHATSAPP_TEMPLATE =
  'Ciao {nome}, ti ricordo il nostro appuntamento di {giorno} alle {ora}. A presto!'

/** Fill the template placeholders with the session's data. */
export const renderTemplate = (
  template: string,
  session: SessionWithRelations
): string => {
  const start = new Date(session.scheduled_at)
  const isGroup = !!session.group_id
  const first = session.patients?.first_name ?? ''
  const last = session.patients?.last_name ?? ''
  const groupName = session.patient_groups?.name ?? ''

  const values: Record<string, string> = {
    '{nome}': isGroup ? groupName : first,
    '{cognome}': isGroup ? '' : last,
    '{nome_completo}': sessionDisplayName(session),
    '{giorno}': format(start, 'EEEE d MMMM', { locale: it }),
    '{giorno_settimana}': format(start, 'EEEE', { locale: it }),
    '{data}': format(start, 'dd/MM/yyyy'),
    '{ora}': format(start, 'HH:mm'),
    '{durata}': `${session.duration_minutes} minuti`,
    '{prestazione}': session.service_types?.name ?? '',
  }

  return Object.entries(values)
    .reduce((acc, [k, v]) => acc.split(k).join(v), template)
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

/**
 * Normalize an Italian phone number to the international format WhatsApp
 * expects (digits only, country code, no '+').
 * Returns null when the number can't be used.
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

/** wa.me click-to-chat URL with the message pre-filled. */
export const buildWhatsAppUrl = (phone: string, message: string): string =>
  `https://wa.me/${phone}?text=${encodeURIComponent(message)}`

/**
 * The patient's usable phone number: the main one, falling back to the first
 * additional phone contact.
 */
export const sessionPhone = (
  session: SessionWithRelations,
  extraContacts?: Array<{ kind: string; value: string }>
): string | null => {
  const direct = normalizePhone(session.patients?.phone)
  if (direct) return direct
  const fromContacts = extraContacts?.find((c) => c.kind === 'phone')?.value
  return normalizePhone(fromContacts)
}
