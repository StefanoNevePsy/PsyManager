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
  useDeleteSessionScoped,
  useConvertSessionToSeries,
  SessionWithRelations,
  DeleteScope,
} from '@/hooks/useSessions'
import {
  Button,
  Modal,
  Card,
  PageHeader,
  ConfirmDialog,
  Skeleton,
  Input,
  useToast,
} from '@/components/ui'
import SessionForm from '@/components/sessions/SessionForm'
import CalendarView from '@/components/sessions/CalendarView'
import SessionsList from '@/components/sessions/SessionsList'
import GoogleCalendarSync from '@/components/sessions/GoogleCalendarSync'
import { SessionFormData } from '@/lib/schemas'
import { useGoogleCalendarSync } from '@/hooks/useGoogleCalendarSync'
import { useGoogleCalendarStore } from '@/stores/googleCalendarStore'
import { useCreatePayment } from '@/hooks/usePayments'

type View = 'calendar' | 'list'

export default function SessionsPage() {
  const { toast } = useToast()
  const [view, setView] = useState<View>('calendar')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<SessionWithRelations | null>(null)
  const [deleting, setDeleting] = useState<SessionWithRelations | null>(null)
  const [defaultDate, setDefaultDate] = useState<Date | undefined>()
  const [payingSession, setPayingSession] = useState<SessionWithRelations | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')

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
  const deleteScopedMutation = useDeleteSessionScoped()
  const convertToSeriesMutation = useConvertSessionToSeries()
  const [deleteScope, setDeleteScope] = useState<DeleteScope>('one')
  const createPaymentMutation = useCreatePayment()

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
        recurrence: data.recurrence,
      }

      if (editing) {
        // If the user enabled recurrence on an existing non-recurring session,
        // convert it into a series (keeps the original as the first occurrence).
        const isConvertingToSeries =
          !editing.series_id && data.recurrence?.enabled === true

        if (isConvertingToSeries && data.recurrence) {
          const result = await convertToSeriesMutation.mutateAsync({
            sessionId: editing.id,
            patientId: cleanData.patient_id,
            serviceTypeId: cleanData.service_type_id,
            scheduledAt: cleanData.scheduled_at,
            durationMinutes: cleanData.duration_minutes,
            notes: cleanData.notes,
            recurrence: data.recurrence,
          })
          toast.success(`${result.occurrencesCount} sedute pianificate`, {
            description: 'La seduta originale è ora la prima della serie',
          })
        } else {
          const savedSession = await updateMutation.mutateAsync({
            id: editing.id,
            updates: {
              patient_id: cleanData.patient_id,
              service_type_id: cleanData.service_type_id,
              scheduled_at: cleanData.scheduled_at,
              duration_minutes: cleanData.duration_minutes,
              notes: cleanData.notes,
            },
          })
          toast.success('Seduta aggiornata')

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
        }
      } else {
        const result = await createMutation.mutateAsync(cleanData)
        if (result.occurrencesCount > 1) {
          toast.success(`${result.occurrencesCount} sedute create`, {
            description: 'Le occorrenze ricorrenti sono state pianificate',
          })
        } else {
          toast.success('Seduta pianificata')
        }

        if (isConnected() && result.session && result.occurrencesCount === 1) {
          try {
            await pushSessionToCalendar(result.session as SessionWithRelations)
            toast.info('Sincronizzata su Google Calendar')
          } catch (err) {
            toast.warning('Salvata, ma sync Calendar fallita', {
              description: err instanceof Error ? err.message : 'Riprova dalle Impostazioni',
            })
          }
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

  const openDeleteDialog = (session: SessionWithRelations) => {
    setDeleting(session)
    setDeleteScope('one')
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      const calendarEventId = deleting.google_calendar_event_id
      const isRecurring = !!deleting.series_id

      if (isRecurring && deleteScope !== 'one') {
        const result = await deleteScopedMutation.mutateAsync({
          sessionId: deleting.id,
          seriesId: deleting.series_id,
          scheduledAt: deleting.scheduled_at,
          scope: deleteScope,
        })
        toast.success(`${result.deletedCount} sedute eliminate`)
      } else {
        await deleteMutation.mutateAsync(deleting.id)
        toast.success('Seduta eliminata')
      }

      if (isConnected() && calendarEventId) {
        try {
          await removeSessionFromCalendar(calendarEventId)
        } catch {
          // non-fatal
        }
      }

      setDeleting(null)
      setDeleteScope('one')
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
            onDelete={openDeleteDialog}
            onPay={(session) => {
              setPayingSession(session)
              setPaymentAmount(
                Number(session.service_types?.price || 0).toFixed(2)
              )
            }}
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
          onDelete={
            editing
              ? () => {
                  setModalOpen(false)
                  setDeleting(editing)
                  setEditing(null)
                }
              : undefined
          }
          loading={
            createMutation.isPending ||
            updateMutation.isPending ||
            convertToSeriesMutation.isPending
          }
        />
      </Modal>

      {/* Delete dialog: simple for non-recurring, with scope options for recurring */}
      {deleting && !deleting.series_id && (
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
      )}

      <Modal
        isOpen={!!deleting && !!deleting.series_id}
        onClose={() => {
          setDeleting(null)
          setDeleteScope('one')
        }}
        title="Eliminare seduta ricorrente"
        description={
          deleting
            ? `${deleting.patients?.last_name} ${deleting.patients?.first_name} — questa seduta fa parte di una serie ricorrente`
            : ''
        }
        size="md"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="flex items-start gap-3 p-3 rounded-md border border-border cursor-pointer hover:border-foreground/20 transition-colors">
              <input
                type="radio"
                value="one"
                checked={deleteScope === 'one'}
                onChange={() => setDeleteScope('one')}
                className="mt-0.5 text-primary focus:ring-primary"
              />
              <div>
                <p className="font-medium text-sm">Solo questa seduta</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Le altre occorrenze della serie restano invariate
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-md border border-border cursor-pointer hover:border-foreground/20 transition-colors">
              <input
                type="radio"
                value="this_and_following"
                checked={deleteScope === 'this_and_following'}
                onChange={() => setDeleteScope('this_and_following')}
                className="mt-0.5 text-primary focus:ring-primary"
              />
              <div>
                <p className="font-medium text-sm">Questa e tutte le successive</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Mantiene le sedute precedenti già svolte
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-md border border-border cursor-pointer hover:border-foreground/20 transition-colors">
              <input
                type="radio"
                value="all_future"
                checked={deleteScope === 'all_future'}
                onChange={() => setDeleteScope('all_future')}
                className="mt-0.5 text-primary focus:ring-primary"
              />
              <div>
                <p className="font-medium text-sm">Tutte le sedute future</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Cancella tutte le occorrenze a partire da oggi (le passate restano)
                </p>
              </div>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button
              variant="outline"
              onClick={() => {
                setDeleting(null)
                setDeleteScope('one')
              }}
              disabled={deleteScopedMutation.isPending || deleteMutation.isPending}
            >
              Annulla
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              loading={deleteScopedMutation.isPending || deleteMutation.isPending}
            >
              Elimina
            </Button>
          </div>
        </div>
      </Modal>

      {/* Quick payment modal */}
      <Modal
        isOpen={!!payingSession}
        onClose={() => {
          setPayingSession(null)
          setPaymentAmount('')
        }}
        title="Registra pagamento"
        description={
          payingSession
            ? `${payingSession.patients?.last_name} ${payingSession.patients?.first_name} — ${payingSession.service_types?.name}`
            : ''
        }
        size="md"
      >
        {payingSession && (
          <div className="space-y-4">
            <div className="p-3 bg-secondary/50 rounded-md">
              <p className="text-xs text-muted-foreground">Importo pattuito</p>
              <p className="text-lg font-semibold">
                €{Number(payingSession.service_types?.price || 0).toFixed(2)}
              </p>
            </div>

            <Input
              label="Importo pagato"
              type="number"
              step="0.01"
              min="0"
              placeholder="Lascia vuoto per importo pattuito"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
            />

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="outline"
                onClick={() => {
                  setPayingSession(null)
                  setPaymentAmount('')
                }}
                disabled={createPaymentMutation.isPending}
              >
                Annulla
              </Button>
              <Button
                onClick={async () => {
                  try {
                    const amount =
                      paymentAmount && paymentAmount.trim()
                        ? Number(paymentAmount)
                        : Number(payingSession.service_types?.price || 0)

                    await createPaymentMutation.mutateAsync({
                      patient_id: payingSession.patient_id,
                      session_id: payingSession.id,
                      amount,
                      payment_date: new Date().toISOString().split('T')[0],
                      payment_method: 'other',
                      notes: `Pagamento rapido da seduta ${payingSession.service_types?.name}`,
                    })
                    toast.success('Pagamento registrato')
                    setPayingSession(null)
                    setPaymentAmount('')
                  } catch (error) {
                    toast.error('Errore nel salvataggio', {
                      description: error instanceof Error ? error.message : 'Riprova',
                    })
                  }
                }}
                loading={createPaymentMutation.isPending}
              >
                Registra pagamento
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
