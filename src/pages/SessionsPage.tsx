import { useState, useMemo, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
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
import WeeklyTimelineView from '@/components/sessions/WeeklyTimelineView'
import GoogleCalendarSync from '@/components/sessions/GoogleCalendarSync'
import ClinicalNoteForm from '@/components/clinical-notes/ClinicalNoteForm'
import { SessionFormData, ClinicalNoteFormData } from '@/lib/schemas'
import { useGoogleCalendarSync } from '@/hooks/useGoogleCalendarSync'
import { useGoogleCalendarStore } from '@/stores/googleCalendarStore'
import { useCreatePayment, usePatientBalanceMap } from '@/hooks/usePayments'
import { useCreateClinicalNote } from '@/hooks/useClinicalNotes'
import { sessionDisplayName, isBillableStatus } from '@/lib/sessionDisplay'

type View = 'calendar' | 'list' | 'weekly'

export default function SessionsPage() {
  const { toast } = useToast()
  const location = useLocation()
  const [view, setView] = useState<View>('calendar')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<SessionWithRelations | null>(null)
  const [deleting, setDeleting] = useState<SessionWithRelations | null>(null)
  const [defaultDate, setDefaultDate] = useState<Date | undefined>()
  const [payingSession, setPayingSession] = useState<SessionWithRelations | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [diarySession, setDiarySession] = useState<SessionWithRelations | null>(null)
  const [pendingEditId, setPendingEditId] = useState<string | null>(null)

  const [pendingOpenPayment, setPendingOpenPayment] = useState(false)

  // Handle navigation from dashboard, widget or reminder notifications: capture
  // the requested session id, set currentDate so the right month is loaded,
  // then wait for sessions. If the navigation requested the payment modal
  // (from a post-session reminder), open that too once the session is found.
  useEffect(() => {
    const state = location.state as
      | {
          editSessionId?: string
          editSessionDate?: string
          openPayment?: boolean
        }
      | null
    if (state?.editSessionId) {
      if (state.editSessionDate) {
        setCurrentDate(new Date(state.editSessionDate))
      }
      setPendingEditId(state.editSessionId)
      if (state.openPayment) setPendingOpenPayment(true)
      // Clear navigation state so navigating back doesn't reopen the modal
      window.history.replaceState({}, '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  // Once sessions are loaded, open the modal for the pending edit id. If the
  // navigation also requested the payment modal (post-session reminder), open
  // the payment dialog instead of the edit form.
  useEffect(() => {
    if (!pendingEditId || isLoading) return
    const session = sessions.find((s) => s.id === pendingEditId)
    if (session) {
      if (pendingOpenPayment && session.service_types?.type === 'private') {
        setPayingSession(session)
        setPaymentAmount(computeSuggestedAmount(session).toFixed(2))
      } else {
        setEditing(session)
        setModalOpen(true)
      }
      setPendingEditId(null)
      setPendingOpenPayment(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingEditId, sessions, isLoading, pendingOpenPayment])

  const createMutation = useCreateSession()
  const updateMutation = useUpdateSession()
  const deleteMutation = useDeleteSession()
  const deleteScopedMutation = useDeleteSessionScoped()
  const convertToSeriesMutation = useConvertSessionToSeries()
  const [deleteScope, setDeleteScope] = useState<DeleteScope>('one')
  const createPaymentMutation = useCreatePayment()
  const createNoteMutation = useCreateClinicalNote()
  const balanceMap = usePatientBalanceMap()

  // Balance BEFORE this session: the balance map already includes this
  // session's due once it has ended (and is billable), so subtract it back
  // out to avoid suggesting a doubled amount.
  const computePreviousBalance = (session: SessionWithRelations): number => {
    const entityId = session.patient_id ?? session.group_id ?? ''
    const balance = balanceMap.get(entityId) || 0
    const sessionPrice = Number(session.service_types?.price || 0)
    const sessionEnd =
      new Date(session.scheduled_at).getTime() + session.duration_minutes * 60_000
    const includedInBalance =
      sessionEnd <= Date.now() &&
      isBillableStatus(session.status) &&
      session.service_types?.type === 'private'
    return includedInBalance ? balance - sessionPrice : balance
  }

  // Suggested quick-payment amount: session price + previous debit
  // (or session price − previous credit).
  const computeSuggestedAmount = (session: SessionWithRelations): number => {
    const sessionPrice = Number(session.service_types?.price || 0)
    return Math.max(0, sessionPrice + computePreviousBalance(session))
  }

  const { isConnected } = useGoogleCalendarStore()
  const { pushSessionToCalendar, removeSessionFromCalendar } =
    useGoogleCalendarSync()

  const openCreateModal = (date?: Date) => {
    // Clicking a day in the month view yields local midnight — default to a
    // sensible working hour instead of 00:00
    let d = date
    if (d && d.getHours() === 0 && d.getMinutes() === 0) {
      d = new Date(d)
      d.setHours(9, 0, 0, 0)
    }
    setEditing(null)
    setDefaultDate(d)
    setModalOpen(true)
  }

  const openEditModal = (session: SessionWithRelations) => {
    setEditing(session)
    setDefaultDate(undefined)
    setModalOpen(true)
  }

  const handleSubmit = async (data: SessionFormData) => {
    try {
      // Explicit nulls: `undefined` keys are dropped by JSON serialization,
      // which would leave a stale patient_id/group_id on the row when the
      // user switches an existing session between individual and group.
      const cleanData = {
        patient_id: data.patient_id || null,
        group_id: data.group_id || null,
        session_type: data.session_type,
        status: data.status || 'scheduled',
        service_type_id: data.service_type_id,
        scheduled_at: data.scheduled_at,
        duration_minutes: data.duration_minutes,
        notes: data.notes || null,
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
            groupId: cleanData.group_id,
            sessionType: cleanData.session_type,
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
              group_id: cleanData.group_id,
              session_type: cleanData.session_type,
              status: cleanData.status,
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

      let eventIdsToRemove: string[] = calendarEventId ? [calendarEventId] : []

      if (isRecurring && deleteScope !== 'one') {
        const result = await deleteScopedMutation.mutateAsync({
          sessionId: deleting.id,
          seriesId: deleting.series_id,
          scheduledAt: deleting.scheduled_at,
          scope: deleteScope,
        })
        toast.success(`${result.deletedCount} sedute eliminate`)
        // Remove the Calendar events of EVERY deleted occurrence, not just
        // the clicked one — otherwise orphan events pile up on Google.
        eventIdsToRemove = result.deletedEventIds
      } else {
        await deleteMutation.mutateAsync(deleting.id)
        toast.success('Seduta eliminata')
      }

      if (isConnected() && eventIdsToRemove.length > 0) {
        for (const eventId of eventIdsToRemove) {
          try {
            await removeSessionFromCalendar(eventId)
          } catch {
            // non-fatal
          }
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
            <button
              onClick={() => setView('weekly')}
              aria-pressed={view === 'weekly'}
              className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium transition-all ${
                view === 'weekly'
                  ? 'bg-card text-foreground shadow-soft'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <CalendarDays className="w-4 h-4" strokeWidth={1.85} />
              Settimanale
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
        ) : view === 'weekly' ? (
          <WeeklyTimelineView
            currentDate={currentDate}
            onDateChange={setCurrentDate}
            sessions={sessions}
            onSessionClick={openEditModal}
          />
        ) : (
          <SessionsList
            sessions={sessions}
            onEdit={openEditModal}
            onDelete={openDeleteDialog}
            onPay={(session) => {
              setPayingSession(session)
              setPaymentAmount(computeSuggestedAmount(session).toFixed(2))
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
          onPay={
            editing && editing.service_types?.type === 'private'
              ? () => {
                  setPayingSession(editing)
                  setPaymentAmount(computeSuggestedAmount(editing).toFixed(2))
                }
              : undefined
          }
          onAddToDiary={
            // Clinical notes require an individual patient — hidden for
            // group sessions until group notes are supported.
            editing && editing.patient_id
              ? () => {
                  setDiarySession(editing)
                  setModalOpen(false)
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
          description={`La seduta con ${sessionDisplayName(deleting)} verrà rimossa. L'azione non è reversibile.`}
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
            ? `${sessionDisplayName(deleting)} — questa seduta fa parte di una serie ricorrente`
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
            ? `${sessionDisplayName(payingSession)} — ${payingSession.service_types?.name}`
            : ''
        }
        size="md"
      >
        {payingSession && (() => {
          const sessionPrice = Number(payingSession.service_types?.price || 0)
          const previousBalance = computePreviousBalance(payingSession)
          const suggested = Math.max(0, sessionPrice + previousBalance)
          const isDebit = previousBalance > 0
          const isCredit = previousBalance < 0
          return (
          <div className="space-y-4">
            {/* Session price */}
            <div className="p-3 bg-secondary/50 rounded-md">
              <p className="text-xs text-muted-foreground">Importo pattuito (questa seduta)</p>
              <p className="text-lg font-semibold tabular-nums">
                € {sessionPrice.toFixed(2)}
              </p>
            </div>

            {/* Previous balance */}
            {Math.abs(previousBalance) >= 0.01 && (
              <div
                className={`p-3 rounded-md border ${
                  isDebit
                    ? 'bg-destructive/10 border-destructive/20 text-destructive'
                    : 'bg-success/10 border-success/20 text-success'
                }`}
              >
                <p className="text-xs font-medium opacity-80">
                  {isDebit ? 'Debito da sedute precedenti' : 'Credito da sedute precedenti'}
                </p>
                <p className="text-lg font-semibold tabular-nums">
                  {isDebit ? '+' : '−'} € {Math.abs(previousBalance).toFixed(2)}
                </p>
              </div>
            )}

            {/* Suggested total */}
            {(isDebit || isCredit) && (
              <div className="p-3 bg-primary-soft text-primary rounded-md border border-primary/20">
                <p className="text-xs font-medium opacity-80">
                  {isDebit ? 'Totale suggerito (seduta + debito)' : 'Totale suggerito (seduta − credito)'}
                </p>
                <p className="text-xl font-semibold tabular-nums">
                  € {suggested.toFixed(2)}
                </p>
              </div>
            )}

            <Input
              label="Importo pagato"
              type="number"
              step="0.01"
              min="0"
              placeholder="Lascia vuoto per importo suggerito"
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
                        : suggested

                    await createPaymentMutation.mutateAsync({
                      patient_id: payingSession.patient_id,
                      group_id: payingSession.group_id ?? null,
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
          )
        })()}
      </Modal>

      {/* Add to clinical diary modal */}
      <Modal
        isOpen={!!diarySession}
        onClose={() => setDiarySession(null)}
        title="Aggiungi al diario clinico"
        description={
          diarySession
            ? `${sessionDisplayName(diarySession)} — seduta del ${new Date(diarySession.scheduled_at).toLocaleString('it-IT', { dateStyle: 'long', timeStyle: 'short' })}`
            : ''
        }
        size="lg"
      >
        {diarySession && (
          <ClinicalNoteForm
            defaultPatientId={diarySession.patient_id ?? undefined}
            defaultSessionId={diarySession.id}
            defaultNoteDate={(() => {
              const d = new Date(diarySession.scheduled_at)
              const yyyy = d.getFullYear()
              const mm = String(d.getMonth() + 1).padStart(2, '0')
              const dd = String(d.getDate()).padStart(2, '0')
              return `${yyyy}-${mm}-${dd}`
            })()}
            onSubmit={async (data: ClinicalNoteFormData) => {
              try {
                await createNoteMutation.mutateAsync({
                  patient_id: data.patient_id,
                  session_id: data.session_id || null,
                  title: data.title || null,
                  content: data.content,
                  note_date: data.note_date,
                })
                toast.success('Nota aggiunta al diario')
                setDiarySession(null)
              } catch (error) {
                toast.error('Errore nel salvataggio', {
                  description: error instanceof Error ? error.message : 'Riprova',
                })
              }
            }}
            onCancel={() => setDiarySession(null)}
            loading={createNoteMutation.isPending}
          />
        )}
      </Modal>
    </div>
  )
}
