import { useState, useMemo } from 'react'
import { Plus, List, CalendarDays } from 'lucide-react'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
} from 'date-fns'
import {
  useSessions,
  useCreateSession,
  useUpdateSession,
  useDeleteSession,
  SessionWithRelations,
} from '@/hooks/useSessions'
import {
  Button,
  Modal,
  Card,
  PageHeader,
  ConfirmDialog,
  Skeleton,
  useToast,
} from '@/components/ui'
import SessionForm from '@/components/sessions/SessionForm'
import CalendarView from '@/components/sessions/CalendarView'
import SessionsList from '@/components/sessions/SessionsList'
import GoogleCalendarSync from '@/components/sessions/GoogleCalendarSync'
import { SessionFormData } from '@/lib/schemas'
import { useGoogleCalendarSync } from '@/hooks/useGoogleCalendarSync'
import { useGoogleCalendarStore } from '@/stores/googleCalendarStore'

type View = 'calendar' | 'list'

export default function SessionsPage() {
  const { toast } = useToast()
  const [view, setView] = useState<View>('calendar')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<SessionWithRelations | null>(null)
  const [deleting, setDeleting] = useState<SessionWithRelations | null>(null)
  const [defaultDate, setDefaultDate] = useState<Date | undefined>()

  const dateRange = useMemo(() => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    return {
      start: startOfWeek(monthStart, { weekStartsOn: 1 }),
      end: endOfWeek(monthEnd, { weekStartsOn: 1 }),
    }
  }, [currentDate])

  const { data: sessions = [], isLoading } = useSessions(
    dateRange.start,
    dateRange.end
  )

  const createMutation = useCreateSession()
  const updateMutation = useUpdateSession()
  const deleteMutation = useDeleteSession()

  const { isConnected } = useGoogleCalendarStore()
  const { pushSessionToCalendar, removeSessionFromCalendar } =
    useGoogleCalendarSync()

  const openCreateModal = (date?: Date) => {
    setEditing(null)
    setDefaultDate(date)
    setModalOpen(true)
  }

  const openEditModal = (session: SessionWithRelations) => {
    setEditing(session)
    setDefaultDate(undefined)
    setModalOpen(true)
  }

  const handleSubmit = async (data: SessionFormData) => {
    try {
      const cleanData = {
        patient_id: data.patient_id,
        service_type_id: data.service_type_id,
        scheduled_at: data.scheduled_at,
        duration_minutes: data.duration_minutes,
        notes: data.notes || undefined,
      }

      let savedSession
      if (editing) {
        savedSession = await updateMutation.mutateAsync({
          id: editing.id,
          updates: cleanData,
        })
        toast.success('Seduta aggiornata')
      } else {
        savedSession = await createMutation.mutateAsync(cleanData)
        toast.success('Seduta pianificata')
      }

      if (isConnected() && savedSession) {
        try {
          await pushSessionToCalendar(savedSession as SessionWithRelations)
          toast.info('Sincronizzata su Google Calendar')
        } catch (err) {
          toast.warning('Salvata, ma sync Calendar fallita', {
            description: err instanceof Error ? err.message : 'Riprova dalle Impostazioni',
          })
        }
      }

      setModalOpen(false)
      setEditing(null)
      setDefaultDate(undefined)
    } catch (error) {
      toast.error('Salvataggio fallito', {
        description: error instanceof Error ? error.message : 'Riprova tra qualche istante',
      })
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      const calendarEventId = deleting.google_calendar_event_id
      await deleteMutation.mutateAsync(deleting.id)

      if (isConnected() && calendarEventId) {
        try {
          await removeSessionFromCalendar(calendarEventId)
        } catch {
          // non-fatal: session deleted, calendar cleanup will retry next sync
        }
      }

      setDeleting(null)
      toast.success('Seduta eliminata')
    } catch (error) {
      toast.error('Eliminazione fallita', {
        description: error instanceof Error ? error.message : 'Riprova tra qualche istante',
      })
    }
  }

  return (
    <div className="px-4 md:px-10 py-8 md:py-12 space-y-8 max-w-[1400px] mx-auto">
      <PageHeader
        eyebrow="Agenda"
        title="Sedute"
        description="Calendario e lista delle tue sedute di terapia. Sincronizzate con Google Calendar se attivo."
        action={
          <Button onClick={() => openCreateModal()}>
            <Plus className="w-4 h-4" strokeWidth={2.25} />
            Nuova seduta
          </Button>
        }
      />

      <Card variant="quiet" padding="md">
        <GoogleCalendarSync />
      </Card>

      <Card padding="none">
        <div className="flex items-center justify-between p-4 border-b border-border flex-wrap gap-3">
          <div className="inline-flex p-1 bg-muted rounded-lg">
            <button
              onClick={() => setView('calendar')}
              aria-pressed={view === 'calendar'}
              className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium transition-all ${
                view === 'calendar'
                  ? 'bg-card text-foreground shadow-soft'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <CalendarDays className="w-4 h-4" strokeWidth={1.85} />
              Calendario
            </button>
            <button
              onClick={() => setView('list')}
              aria-pressed={view === 'list'}
              className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium transition-all ${
                view === 'list'
                  ? 'bg-card text-foreground shadow-soft'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <List className="w-4 h-4" strokeWidth={1.85} />
              Lista
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(new Date())}
          >
            Oggi
          </Button>
        </div>

        <div className="p-4 md:p-5">
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full bg-muted" />
            ))}
          </div>
        ) : view === 'calendar' ? (
          <CalendarView
            currentDate={currentDate}
            onDateChange={setCurrentDate}
            sessions={sessions}
            onDayClick={openCreateModal}
            onSessionClick={openEditModal}
          />
        ) : (
          <SessionsList
            sessions={sessions}
            onEdit={openEditModal}
            onDelete={setDeleting}
            emptyTitle="Nessuna seduta in programma"
            emptyDescription="Aggiungi la tua prima seduta per iniziare"
          />
        )}
        </div>
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditing(null)
          setDefaultDate(undefined)
        }}
        title={editing ? 'Modifica seduta' : 'Nuova seduta'}
        description={editing ? 'Aggiorna data, paziente o prestazione.' : 'Pianifica una seduta scegliendo paziente e prestazione.'}
        size="lg"
      >
        <SessionForm
          initialData={editing || undefined}
          defaultDate={defaultDate}
          onSubmit={handleSubmit}
          onCancel={() => {
            setModalOpen(false)
            setEditing(null)
            setDefaultDate(undefined)
          }}
          loading={createMutation.isPending || updateMutation.isPending}
        />
      </Modal>

      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Eliminare la seduta?"
        description={`La seduta con ${deleting?.patients?.last_name} ${deleting?.patients?.first_name} verrà rimossa. L'azione non è reversibile.`}
        confirmText="Elimina"
        destructive
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
