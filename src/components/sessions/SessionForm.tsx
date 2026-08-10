import { useEffect, useState } from 'react'
import { useForm, useWatch, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { startOfDay, endOfDay, format } from 'date-fns'
import { Repeat, ChevronDown, Info, DollarSign, NotebookPen, Users, AlertTriangle, Trash2 } from 'lucide-react'
import { sessionSchema, SessionFormData } from '@/lib/schemas'
import { Button, Input, Select, Textarea } from '@/components/ui'
import { usePatients } from '@/hooks/usePatients'
import { usePatientGroups } from '@/hooks/usePatientGroups'
import { useServiceTypes } from '@/hooks/useServiceTypes'
import { useSessions } from '@/hooks/useSessions'
import { describeRecurrence, generateOccurrences } from '@/lib/recurrence'
import { sessionDisplayName, SESSION_STATUS_LABELS } from '@/lib/sessionDisplay'
import { Database, SessionStatus } from '@/types/database'

type Session = Database['public']['Tables']['sessions']['Row']

interface Props {
  initialData?: Session
  defaultDate?: Date
  /** Preselect a patient when creating from a patient's page */
  defaultPatientId?: string
  onSubmit: (data: SessionFormData) => void | Promise<void>
  onCancel: () => void
  onDelete?: () => void
  onPay?: () => void
  onAddToDiary?: () => void
  loading?: boolean
}

const formatDateTimeLocal = (date: Date) => {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}

const DAYS_OF_WEEK = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mer' },
  { value: 4, label: 'Gio' },
  { value: 5, label: 'Ven' },
  { value: 6, label: 'Sab' },
  { value: 0, label: 'Dom' },
]

export default function SessionForm({
  initialData,
  defaultDate,
  defaultPatientId,
  onSubmit,
  onCancel,
  onDelete,
  onPay,
  onAddToDiary,
  loading = false,
}: Props) {
  const { data: patients = [] } = usePatients()
  const { data: patientGroups = [] } = usePatientGroups()
  const { data: serviceTypes = [] } = useServiceTypes()
  const [recurrenceOpen, setRecurrenceOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<'patient' | 'group'>('patient')

  const initialDateValue = initialData?.scheduled_at
    ? formatDateTimeLocal(new Date(initialData.scheduled_at))
    : defaultDate
      ? formatDateTimeLocal(defaultDate)
      : formatDateTimeLocal(new Date())

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<SessionFormData>({
    resolver: zodResolver(sessionSchema),
    defaultValues: {
      patient_id: initialData?.patient_id || defaultPatientId || '',
      group_id: initialData?.group_id || '',
      session_type: initialData?.session_type || 'individuale',
      status: initialData?.status || 'scheduled',
      service_type_id: initialData?.service_type_id || '',
      scheduled_at: initialDateValue,
      duration_minutes: initialData?.duration_minutes || 60,
      notes: initialData?.notes || '',
      recurrence: {
        enabled: false,
        frequency: 'weekly',
        interval_value: 1,
        interval_unit: 'week',
        days_of_week: [],
        end_type: 'count',
        end_count: 8,
        end_date: '',
      },
    },
  })

  // Update selected type based on initial data or current values
  useEffect(() => {
    if (initialData?.group_id) {
      setSelectedType('group')
    } else if (initialData?.patient_id) {
      setSelectedType('patient')
    }
  }, [initialData])

  const serviceTypeId = useWatch({ control, name: 'service_type_id' })
  const recurrence = useWatch({ control, name: 'recurrence' })
  const scheduledAt = useWatch({ control, name: 'scheduled_at' })
  const durationMinutes = useWatch({ control, name: 'duration_minutes' })

  // Overlap detection: fetch the sessions of the chosen day and warn when the
  // selected slot collides with another (non-cancelled) session.
  const scheduledDate = scheduledAt ? new Date(scheduledAt) : null
  const hasValidDate = !!scheduledDate && !isNaN(scheduledDate.getTime())
  const conflictDay = hasValidDate ? scheduledDate : new Date()
  const { data: daySessions = [] } = useSessions(
    startOfDay(conflictDay),
    endOfDay(conflictDay)
  )
  const conflicts = (() => {
    if (!hasValidDate) return []
    const newStart = scheduledDate.getTime()
    const newEnd = newStart + (durationMinutes || 60) * 60_000
    return daySessions.filter((s) => {
      if (s.id === initialData?.id) return false
      if (s.status === 'cancelled') return false
      const start = new Date(s.scheduled_at).getTime()
      const end = start + s.duration_minutes * 60_000
      return start < newEnd && end > newStart
    })
  })()

  useEffect(() => {
    if (serviceTypeId && !initialData) {
      const st = serviceTypes.find((s) => s.id === serviceTypeId)
      if (st) {
        setValue('duration_minutes', st.duration_minutes)
      }
    }
  }, [serviceTypeId, serviceTypes, setValue, initialData])

  const recurrenceEnabled = recurrence?.enabled === true
  const isEditing = !!initialData
  const isPartOfSeries = !!initialData?.series_id
  // Recurrence section is shown when creating a new session OR when editing a
  // session that's not yet part of a series (so the user can convert it).
  const showRecurrenceSection = !isEditing || !isPartOfSeries

  // Live preview of occurrences
  const occurrencesPreview = (() => {
    if (!recurrenceEnabled || !scheduledAt || !recurrence) return null
    try {
      const occurrences = generateOccurrences({
        startAt: new Date(scheduledAt),
        recurrence: {
          frequency: recurrence.frequency,
          interval_value: recurrence.interval_value,
          interval_unit: recurrence.interval_unit,
          days_of_week: recurrence.days_of_week,
          end_type: recurrence.end_type,
          end_count: recurrence.end_count,
          end_date: recurrence.end_date,
        },
      })
      return occurrences
    } catch {
      return null
    }
  })()

  const handleFormSubmit = (data: SessionFormData) => {
    const isoDate = new Date(data.scheduled_at).toISOString()
    onSubmit({ ...data, scheduled_at: isoDate })
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {/* Patient/Group Type Selector */}
      <div>
        <label className="block text-sm font-medium mb-2">Tipo di Seduta *</label>
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => {
              setSelectedType('patient')
              setValue('group_id', '')
              setValue('session_type', 'individuale')
            }}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              selectedType === 'patient'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-foreground hover:bg-secondary/70'
            }`}
          >
            Individuale
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedType('group')
              setValue('patient_id', '')
              // The group select only offers coppia/familiare — make sure the
              // tracked value can never stay 'individuale' for a group session
              setValue('session_type', 'coppia')
            }}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              selectedType === 'group'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-foreground hover:bg-secondary/70'
            }`}
          >
            <Users className="w-4 h-4 inline mr-1" />
            Gruppo
          </button>
        </div>
      </div>

      {/* Patient Selection */}
      {selectedType === 'patient' && (
        <Select
          id="patient_id"
          label="Paziente *"
          {...register('patient_id')}
          error={errors.patient_id?.message}
          options={[
            { value: '', label: 'Seleziona un paziente...' },
            ...patients.map((p) => ({
              value: p.id,
              label: `${p.last_name || ''}${p.last_name && p.first_name ? ' ' : ''}${p.first_name}`,
            })),
          ]}
        />
      )}

      {/* Group Selection */}
      {selectedType === 'group' && (
        <>
          <Select
            id="group_id"
            label="Gruppo *"
            {...register('group_id')}
            error={errors.group_id?.message}
            options={[
              { value: '', label: 'Seleziona un gruppo...' },
              ...patientGroups.map((g) => ({
                value: g.id,
                label: `${g.name} (${g.type === 'couple' ? 'Coppia' : g.type === 'family' ? 'Famiglia' : 'Altro'})`,
              })),
            ]}
          />
          <Select
            id="session_type"
            label="Tipo di Seduta *"
            {...register('session_type')}
            options={[
              { value: 'coppia', label: 'Di Coppia' },
              { value: 'familiare', label: 'Familiare' },
            ]}
          />
        </>
      )}

      <Select
        id="service_type_id"
        label="Tipo di Prestazione *"
        {...register('service_type_id')}
        error={errors.service_type_id?.message}
        options={[
          { value: '', label: 'Seleziona un tipo...' },
          ...serviceTypes.map((s) => ({
            value: s.id,
            label: `${s.name} (€${Number(s.price).toFixed(2)})`,
          })),
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          id="scheduled_at"
          label="Data e Ora *"
          type="datetime-local"
          {...register('scheduled_at')}
          error={errors.scheduled_at?.message}
        />

        <Input
          id="duration_minutes"
          label="Durata (minuti) *"
          type="number"
          min={1}
          {...register('duration_minutes', { valueAsNumber: true })}
          error={errors.duration_minutes?.message}
        />
      </div>

      {/* Overlap warning — non-blocking */}
      {conflicts.length > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-md border border-orange-500/30 bg-orange-500/10 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 text-orange-600 flex-shrink-0" strokeWidth={2} />
          <div>
            <p className="font-medium text-orange-600">
              Sovrapposizione con {conflicts.length === 1 ? 'un’altra seduta' : `${conflicts.length} sedute`}
            </p>
            <ul className="text-xs text-orange-600/80 mt-1 space-y-0.5">
              {conflicts.slice(0, 3).map((c) => (
                <li key={c.id}>
                  {format(new Date(c.scheduled_at), 'HH:mm')} — {sessionDisplayName(c)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Status: only meaningful when editing an existing session */}
      {isEditing && (
        <Select
          id="status"
          label="Stato seduta"
          {...register('status')}
          options={(Object.keys(SESSION_STATUS_LABELS) as SessionStatus[]).map((s) => ({
            value: s,
            label: SESSION_STATUS_LABELS[s],
          }))}
          hint="Le sedute annullate o con assenza non vengono conteggiate nei saldi"
        />
      )}

      <Textarea
        id="notes"
        label="Note"
        placeholder="Note sulla seduta..."
        {...register('notes')}
        error={errors.notes?.message}
      />

      {/* Banner for sessions already part of a recurring series */}
      {isPartOfSeries && (
        <div className="flex items-start gap-2 p-3 rounded-md border border-border bg-secondary/40 text-sm">
          <Info className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" strokeWidth={2} />
          <div>
            <p className="font-medium text-foreground">Parte di una serie ricorrente</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Al salvataggio potrai scegliere se applicare le modifiche solo a
              questa seduta o anche a tutte le successive della serie.
            </p>
          </div>
        </div>
      )}

      {/* Recurrence section: shown for new sessions and for existing non-recurring sessions */}
      {showRecurrenceSection && (
        <div className="border-t border-border pt-4">
          <button
            type="button"
            onClick={() => setRecurrenceOpen(!recurrenceOpen)}
            className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
          >
            <Repeat className="w-4 h-4" strokeWidth={2} />
            {isEditing ? 'Trasforma in ricorrente' : 'Ripeti questa seduta'}
            {recurrenceEnabled && (
              <span className="text-2xs px-1.5 py-0.5 rounded bg-primary-soft text-primary font-semibold uppercase tracking-wider">
                Attiva
              </span>
            )}
            <ChevronDown
              className={`w-4 h-4 ml-auto transition-transform ${recurrenceOpen ? 'rotate-180' : ''}`}
              strokeWidth={2}
            />
          </button>

          {recurrenceOpen && (
            <div className="mt-4 space-y-4 pl-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('recurrence.enabled')}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="text-sm">Crea sedute ricorrenti</span>
              </label>

              {recurrenceEnabled && (
                <div className="space-y-4 pl-6 border-l-2 border-border">
                  <Select
                    label="Frequenza"
                    {...register('recurrence.frequency')}
                    options={[
                      { value: 'weekly', label: 'Ogni settimana' },
                      { value: 'biweekly', label: 'Ogni due settimane' },
                      { value: 'monthly', label: 'Ogni mese' },
                      { value: 'custom', label: 'Personalizzata' },
                    ]}
                  />

                  {recurrence?.frequency === 'custom' && (
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="Ogni"
                        type="number"
                        min={1}
                        {...register('recurrence.interval_value', { valueAsNumber: true })}
                      />
                      <Select
                        label="Unità"
                        {...register('recurrence.interval_unit')}
                        options={[
                          { value: 'day', label: 'Giorni' },
                          { value: 'week', label: 'Settimane' },
                          { value: 'month', label: 'Mesi' },
                        ]}
                      />
                    </div>
                  )}

                  {(recurrence?.frequency === 'weekly' || recurrence?.frequency === 'biweekly') && (
                    <div>
                      <p className="text-sm font-medium mb-2">Giorni della settimana</p>
                      <Controller
                        name="recurrence.days_of_week"
                        control={control}
                        render={({ field }) => (
                          <div className="grid grid-cols-4 sm:flex sm:flex-wrap gap-1.5">
                            {DAYS_OF_WEEK.map((d) => {
                              const checked = field.value?.includes(d.value) ?? false
                              return (
                                <button
                                  key={d.value}
                                  type="button"
                                  onClick={() => {
                                    const current = field.value ?? []
                                    if (checked) {
                                      field.onChange(current.filter((v: number) => v !== d.value))
                                    } else {
                                      field.onChange([...current, d.value])
                                    }
                                  }}
                                  className={`px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all ${
                                    checked
                                      ? 'bg-primary text-primary-foreground'
                                      : 'bg-secondary text-foreground hover:bg-secondary/70'
                                  }`}
                                >
                                  {d.label}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      />
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Lascia vuoto per ripetere solo nello stesso giorno della data scelta.
                      </p>
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-medium mb-2">Termina</p>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          value="count"
                          {...register('recurrence.end_type')}
                          className="text-primary focus:ring-primary"
                        />
                        <span>Dopo</span>
                        <Input
                          type="number"
                          min={1}
                          className="w-20"
                          {...register('recurrence.end_count', { valueAsNumber: true })}
                          disabled={recurrence?.end_type !== 'count'}
                        />
                        <span>occorrenze</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          value="until"
                          {...register('recurrence.end_type')}
                          className="text-primary focus:ring-primary"
                        />
                        <span>Il</span>
                        <Input
                          type="date"
                          {...register('recurrence.end_date')}
                          disabled={recurrence?.end_type !== 'until'}
                        />
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          value="never"
                          {...register('recurrence.end_type')}
                          className="text-primary focus:ring-primary"
                        />
                        <span>Mai (a tempo indeterminato)</span>
                      </label>
                    </div>
                  </div>

                  {/* Live preview */}
                  {occurrencesPreview && occurrencesPreview.length > 0 && (
                    <div className="bg-secondary/50 border border-border rounded-md p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Anteprima
                      </p>
                      <p className="text-sm font-medium text-foreground mb-2">
                        {describeRecurrence({
                          frequency: recurrence.frequency,
                          interval_value: recurrence.interval_value,
                          interval_unit: recurrence.interval_unit,
                          days_of_week: recurrence.days_of_week,
                          end_type: recurrence.end_type,
                          end_count: recurrence.end_count,
                          end_date: recurrence.end_date,
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Verranno create <strong>{occurrencesPreview.length}</strong> sedute
                        {occurrencesPreview.length > 1 && (
                          <>
                            {' '}
                            (prima: {occurrencesPreview[0]?.toLocaleDateString('it-IT')}, ultima:{' '}
                            {occurrencesPreview[occurrencesPreview.length - 1]?.toLocaleDateString('it-IT')})
                          </>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {patients.length === 0 && patientGroups.length === 0 && (
        <div className="bg-orange-500/10 text-orange-600 p-3 rounded-lg text-sm">
          Nessun paziente o gruppo trovato. Aggiungi prima un paziente o un gruppo.
        </div>
      )}

      {serviceTypes.length === 0 && (
        <div className="bg-orange-500/10 text-orange-600 p-3 rounded-lg text-sm">
          Nessun tipo di prestazione configurato. Aggiungilo nella sezione Tipi
          Prestazione.
        </div>
      )}

      {/* Sticky action bar: the form is long, and on a phone the primary
          action must stay reachable without scrolling to the bottom.
          Secondary actions share one compact row instead of stacking
          full-width, which pushed everything off screen. */}
      <div className="sticky bottom-0 z-10 -mx-1 px-1 pt-3 pb-1 bg-card border-t border-border space-y-2">
        {initialData && (onDelete || onAddToDiary || onPay) && (
          <div className="flex items-center gap-2">
            {onDelete && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onDelete}
                disabled={loading}
                className="text-destructive hover:bg-destructive/10"
                title="Elimina seduta"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Elimina</span>
              </Button>
            )}
            <div className="flex-1" />
            {onAddToDiary && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onAddToDiary}
                disabled={loading}
                title="Aggiungi al diario clinico"
              >
                <NotebookPen className="w-4 h-4" />
                <span className="hidden sm:inline">Diario</span>
              </Button>
            )}
            {onPay && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onPay}
                disabled={loading}
                title="Registra pagamento"
              >
                <DollarSign className="w-4 h-4" />
                <span className="hidden sm:inline">Pagamento</span>
              </Button>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Annulla
          </Button>
          <Button
            type="submit"
            loading={loading}
            disabled={patients.length === 0 && patientGroups.length === 0 || serviceTypes.length === 0}
            className="w-full sm:w-auto"
          >
            {initialData
              ? recurrenceEnabled
                ? 'Aggiorna e crea ricorrenza'
                : 'Aggiorna'
              : recurrenceEnabled
                ? 'Crea sedute'
                : 'Crea'}
          </Button>
        </div>
      </div>
    </form>
  )
}
