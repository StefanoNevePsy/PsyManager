import { useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { addDays, endOfDay, format, isSameDay, startOfDay } from 'date-fns'
import { it } from 'date-fns/locale'
import { Check, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react'
import { useSessions, SessionWithRelations } from '@/hooks/useSessions'
import { useReminderSettings } from '@/hooks/useReminderSettings'
import { useMarkReminderSent, useUnmarkReminderSent } from '@/hooks/useReminderSent'
import { usePatientContacts } from '@/hooks/usePatientContacts'
import { sessionDisplayName } from '@/lib/sessionDisplay'
import {
  DEFAULT_WHATSAPP_TEMPLATE,
  buildWhatsAppUrl,
  renderTemplate,
  sessionPhone,
} from '@/lib/whatsapp'
import { Button, Card, EmptyState, PageHeader, Skeleton, Tooltip, useToast } from '@/components/ui'

/**
 * Daily workflow screen: pick a day, see its sessions, tap WhatsApp to open
 * a pre-filled chat with the reminder message, and mark it as sent.
 */
export default function RemindersPage() {
  const { toast } = useToast()
  const today = startOfDay(new Date())
  const [selectedDate, setSelectedDate] = useState(() => addDays(today, 1))
  const [templateOpen, setTemplateOpen] = useState(false)

  const dayStart = startOfDay(selectedDate)
  const dayEnd = endOfDay(selectedDate)

  const { data: sessions = [], isLoading } = useSessions(dayStart, dayEnd)
  const { data: settings } = useReminderSettings()
  const { mutateAsync: markSent } = useMarkReminderSent()

  const template = settings?.whatsapp_template || DEFAULT_WHATSAPP_TEMPLATE

  const daySessions = useMemo(
    () =>
      sessions
        .filter((s) => s.status !== 'cancelled')
        .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()),
    [sessions]
  )

  const totalCount = daySessions.length
  const pendingCount = daySessions.filter((s) => !s.reminder_sent_at).length

  const isToday = isSameDay(selectedDate, today)
  const isTomorrow = isSameDay(selectedDate, addDays(today, 1))

  const handleSend = async (session: SessionWithRelations, phone: string) => {
    const message = renderTemplate(template, session)
    const url = buildWhatsAppUrl(phone, message)
    window.open(url, '_blank')
    try {
      await markSent(session.id)
      toast.success('Promemoria segnato come inviato')
    } catch (error) {
      toast.error('Errore nel salvataggio', {
        description: error instanceof Error ? error.message : 'Riprova',
      })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Promemoria WhatsApp"
        description="Invia i promemoria di appuntamento ai pazienti in un paio di tap."
      />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={isToday ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setSelectedDate(today)}
            >
              Oggi
            </Button>
            <Button
              variant={isTomorrow ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setSelectedDate(addDays(today, 1))}
            >
              Domani
            </Button>
            <input
              type="date"
              value={format(selectedDate, 'yyyy-MM-dd')}
              onChange={(e) => {
                if (!e.target.value) return
                const [y, m, d] = e.target.value.split('-').map(Number)
                setSelectedDate(new Date(y, m - 1, d))
              }}
              className="h-8 px-3 text-sm bg-input border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="text-sm text-muted-foreground capitalize">
              {format(selectedDate, 'EEEE d MMMM', { locale: it })}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{pendingCount}</span> da inviare
            {' / '}
            <span className="font-semibold text-foreground">{totalCount}</span> totali
          </p>
        </div>

        <div className="mt-4 pt-4 border-t border-border/60">
          <button
            type="button"
            onClick={() => setTemplateOpen((o) => !o)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {templateOpen ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
            Anteprima messaggio
          </button>
          {templateOpen && (
            <p className="mt-2 text-sm text-foreground/90 bg-muted/40 border border-border/40 rounded-lg p-3 whitespace-pre-wrap">
              {template}
            </p>
          )}
        </div>
      </Card>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : daySessions.length === 0 ? (
        <Card>
          <EmptyState
            icon={MessageCircle}
            title="Nessuna seduta"
            description={`Non ci sono sedute in programma per ${format(selectedDate, 'EEEE d MMMM', { locale: it })}.`}
          />
        </Card>
      ) : (
        <Card padding="none" className="divide-y divide-border/60 overflow-hidden">
          {daySessions.map((session) => (
            <ReminderRow key={session.id} session={session} onSend={handleSend} />
          ))}
        </Card>
      )}
    </div>
  )
}

interface ReminderRowProps {
  session: SessionWithRelations
  onSend: (session: SessionWithRelations, phone: string) => void
}

function ReminderRow({ session, onSend }: ReminderRowProps) {
  const { toast } = useToast()
  const { mutateAsync: unmarkSent, isPending: isUnmarking } = useUnmarkReminderSent()

  // Only fetch extra contacts for individual sessions whose patient has no
  // main phone number — avoids an extra query for the common case.
  const hasMainPhone = !!session.patients?.phone
  const needsExtraContacts = !session.group_id && !hasMainPhone && !!session.patient_id
  const { data: extraContacts } = usePatientContacts(
    needsExtraContacts ? session.patient_id! : undefined
  )

  const phone = sessionPhone(session, extraContacts)
  const sent = !!session.reminder_sent_at
  const buttonDisabled = !!session.group_id || !phone

  const handleUnmark = async () => {
    try {
      await unmarkSent(session.id)
    } catch (error) {
      toast.error('Errore nel salvataggio', {
        description: error instanceof Error ? error.message : 'Riprova',
      })
    }
  }

  return (
    <div className={clsx('flex items-center gap-3 px-4 py-3', sent && 'opacity-60')}>
      <div className="w-12 flex-shrink-0 text-sm font-medium tabular-nums text-foreground">
        {format(new Date(session.scheduled_at), 'HH:mm')}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {sessionDisplayName(session)}
        </p>
        <p className="text-xs text-muted-foreground truncate">{session.service_types?.name}</p>
      </div>

      {sent ? (
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-success bg-success-soft border border-success/20 rounded-full px-2.5 py-1">
            <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
            Inviato
          </span>
          <button
            type="button"
            onClick={handleUnmark}
            disabled={isUnmarking}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 disabled:opacity-50"
          >
            Segna come non inviato
          </button>
        </div>
      ) : (
        <Tooltip label="Numero di telefono mancante" disabled={!buttonDisabled}>
          <span className="flex-shrink-0">
            <Button
              size="sm"
              variant="subtle"
              disabled={buttonDisabled}
              onClick={() => phone && onSend(session, phone)}
            >
              <MessageCircle className="w-4 h-4" strokeWidth={2} />
              WhatsApp
            </Button>
          </span>
        </Tooltip>
      )}
    </div>
  )
}
