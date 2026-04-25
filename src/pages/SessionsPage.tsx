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
      } else {
        savedSession = await createMutation.mutateAsync(cleanData)
      }

      if (isConnected() && savedSession) {
        try {
          await pushSessionToCalendar(savedSession as SessionWithRelations)
        } catch (err) {
          console.error('Calendar sync failed (non-fatal):', err)
        }
      }

      setModalOpen(false)
      setEditing(null)
      setDefaultDate(undefined)
    } catch (error) {
      console.error('Error saving session:', error)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      const calendarEventId = deleting.google_calendar_event_id
      await deleteMutation.mutateAsync(deleting.id)

      if (isConnected() && calendarEventId) {
        await removeSessionFromCalendar(calendarEventId)
      }

      setDeleting(null)
    } catch (error) {
      console.error('Error deleting session:', error)
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <PageHeader
        title="Sedute"
        description="Calendario e gestione delle tue sedute di terapia"
        action={
          <Button onClick={() => openCreateModal()}>
            <Plus className="w-5 h-5" />
            Nuova Seduta
          </Button>
        }
      />

      <Card>
        <GoogleCalendarSync />
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex gap-2">
            <Button
              variant={view === 'calendar' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setView('calendar')}
            >
              <CalendarDays className="w-4 h-4" />
              Calendario
            </Button>
            <Button
              variant={view === 'list' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setView('list')}
            >
              <List className="w-4 h-4" />
              Lista
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(new Date())}
          >
            Oggi
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">
            Caricamento...
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
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditing(null)
          setDefaultDate(undefined)
        }}
        title={editing ? 'Modifica Seduta' : 'Nuova Seduta'}
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
        title="Elimina seduta"
        description={`Sei sicuro di voler eliminare questa seduta con ${deleting?.patients?.last_name} ${deleting?.patients?.first_name}?`}
        confirmText="Elimina"
        destructive
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
