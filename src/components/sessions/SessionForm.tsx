import { useEffect, useState } from 'react'
import { useForm, useWatch, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Repeat, ChevronDown, Info, DollarSign, NotebookPen } from 'lucide-react'
import { sessionSchema, SessionFormData } from '@/lib/schemas'
import { Button, Input, Select, Textarea } from '@/components/ui'
import { usePatients } from '@/hooks/usePatients'
import { useServiceTypes } from '@/hooks/useServiceTypes'
import { describeRecurrence, generateOccurrences } from '@/lib/recurrence'
import { Database } from '@/types/database'

type Session = Database['public']['Tables']['sessions']['Row']

interface Props {
  initialData?: Session
  defaultDate?: Date
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
  onSubmit,
  onCancel,
  onDelete,
  onPay,
  onAddToDiary,
  loading = false,
}: Props) {
  const { data: patients = [] } = usePatients()
  const { data: serviceTypes = [] } = useServiceTypes()
  const [recurrenceOpen, setRecurrenceOpen] = useState(false)

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
      patient_id: initialData?.patient_id || '',
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

  const serviceTypeId = useWatch({ control, name: 'service_type_id' })
  const recurrence = useWatch({ control, name: 'recurrence' })
  const scheduledAt = useWatch({ control, name: 'scheduled_at' })

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
      <Select
        id="patient_id"
        label="Paziente *"
        {...register('patient_id')}
        error={errors.patient_id?.message}
        options={[
          { value: '', label: 'Seleziona un paziente...' },
          ...patients.map((p) => ({
            value: p.id,
            label: `${p.last_name} ${p.first_name}`,
          })),
        ]}
      />

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
              Le modifiche qui valgono solo per questa occorrenza. Per cambiare la
              ricorrenza, elimina le occorrenze future dal pulsante elimina e ricreale.
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
                          <div className="flex flex-wrap gap-1.5">
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
                                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
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

      {patients.length === 0 && (
        <div className="bg-orange-500/10 text-orange-600 p-3 rounded-lg text-sm">
          Nessun paziente trovato. Aggiungi prima un paziente nella sezione Pazienti.
        </div>
      )}

      {serviceTypes.length === 0 && (
        <div className="bg-orange-500/10 text-orange-600 p-3 rounded-lg text-sm">
          Nessun tipo di prestazione configurato. Aggiungilo nella sezione Tipi
          Prestazione.
        </div>
      )}

      <div className="flex justify-between gap-2 pt-4 border-t border-border">
        <div className="flex gap-2">
          {initialData && onDelete && (
            <Button
              type="button"
              variant="destructive"
              onClick={onDelete}
              disabled={loading}
            >
              Elimina
            </Button>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {initialData && onAddToDiary && (
            <Button
              type="button"
              variant="ghost"
              onClick={onAddToDiary}
              disabled={loading}
            >
              <NotebookPen className="w-4 h-4" />
              Aggiungi al diario
            </Button>
          )}
          {initialData && onPay && (
            <Button
              type="button"
              variant="ghost"
              onClick={onPay}
              disabled={loading}
            >
              <DollarSign className="w-4 h-4" />
              Pagamento
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Annulla
          </Button>
          <Button
            type="submit"
            loading={loading}
            disabled={patients.length === 0 || serviceTypes.length === 0}
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
