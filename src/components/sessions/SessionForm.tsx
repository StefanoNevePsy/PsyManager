import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { sessionSchema, SessionFormData } from '@/lib/schemas'
import { Button, Input, Select, Textarea } from '@/components/ui'
import { usePatients } from '@/hooks/usePatients'
import { useServiceTypes } from '@/hooks/useServiceTypes'
import { Database } from '@/types/database'

type Session = Database['public']['Tables']['sessions']['Row']

interface Props {
  initialData?: Session
  defaultDate?: Date
  onSubmit: (data: SessionFormData) => void | Promise<void>
  onCancel: () => void
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

export default function SessionForm({
  initialData,
  defaultDate,
  onSubmit,
  onCancel,
  loading = false,
}: Props) {
  const { data: patients = [] } = usePatients()
  const { data: serviceTypes = [] } = useServiceTypes()

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
    },
  })

  const serviceTypeId = useWatch({ control, name: 'service_type_id' })

  useEffect(() => {
    if (serviceTypeId && !initialData) {
      const st = serviceTypes.find((s) => s.id === serviceTypeId)
      if (st) {
        setValue('duration_minutes', st.duration_minutes)
      }
    }
  }, [serviceTypeId, serviceTypes, setValue, initialData])

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

      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Annulla
        </Button>
        <Button
          type="submit"
          loading={loading}
          disabled={patients.length === 0 || serviceTypes.length === 0}
        >
          {initialData ? 'Aggiorna' : 'Crea'}
        </Button>
      </div>
    </form>
  )
}
