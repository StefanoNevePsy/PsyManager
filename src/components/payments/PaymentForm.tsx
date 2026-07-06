import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { paymentSchema, PaymentFormData } from '@/lib/schemas'
import { Button, Input, Select, Textarea } from '@/components/ui'
import { patientFullName } from '@/lib/sessionDisplay'
import { usePatients } from '@/hooks/usePatients'
import { useServiceTypes } from '@/hooks/useServiceTypes'
import { PAYMENT_METHOD_LABELS } from '@/lib/netIncome'
import { Database } from '@/types/database'

type Payment = Database['public']['Tables']['payments']['Row']

interface Props {
  initialData?: Payment
  defaultPatientId?: string
  onSubmit: (data: PaymentFormData) => void | Promise<void>
  onCancel: () => void
  loading?: boolean
}

export default function PaymentForm({
  initialData,
  defaultPatientId,
  onSubmit,
  onCancel,
  loading = false,
}: Props) {
  const { data: patients = [] } = usePatients()
  const { data: serviceTypes = [] } = useServiceTypes()

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    control,
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      patient_id: initialData?.patient_id || defaultPatientId || '',
      amount: initialData?.amount || 0,
      payment_date:
        initialData?.payment_date || new Date().toISOString().split('T')[0],
      payment_method: (initialData?.payment_method as PaymentFormData['payment_method']) || 'cash',
      notes: initialData?.notes || '',
      service_type_id: '',
    },
  })

  const selectedServiceTypeId = useWatch({ control, name: 'service_type_id' })

  // Auto-fill amount + payment method from service type on selection change
  useEffect(() => {
    if (selectedServiceTypeId) {
      const st = serviceTypes.find((s) => s.id === selectedServiceTypeId)
      if (st) {
        setValue('amount', Number(st.price))
        if (st.default_payment_method) {
          setValue('payment_method', st.default_payment_method)
        }
      }
    }
  }, [selectedServiceTypeId, serviceTypes, setValue])

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Select
        id="patient_id"
        label="Paziente"
        {...register('patient_id')}
        error={errors.patient_id?.message}
        options={[
          { value: '', label: 'Seleziona un paziente (opzionale)...' },
          ...patients.map((p) => ({
            value: p.id,
            label: patientFullName(p),
          })),
        ]}
      />

      <Select
        id="service_type_id"
        label="Prestazione (per autofill importo)"
        {...register('service_type_id')}
        error={errors.service_type_id?.message}
        options={[
          { value: '', label: 'Nessuna prestazione...' },
          ...serviceTypes
            .filter((s) => s.type === 'private')
            .map((s) => ({
              value: s.id,
              label: `${s.name} (€${Number(s.price).toFixed(2)})`,
            })),
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          id="amount"
          label="Importo (€) *"
          type="number"
          step="0.01"
          min={0.01}
          {...register('amount', { valueAsNumber: true })}
          error={errors.amount?.message}
        />

        <Input
          id="payment_date"
          label="Data Pagamento *"
          type="date"
          {...register('payment_date')}
          error={errors.payment_date?.message}
        />
      </div>

      <Select
        id="payment_method"
        label="Metodo di Pagamento *"
        {...register('payment_method')}
        error={errors.payment_method?.message}
        options={Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => ({
          value,
          label,
        }))}
      />

      <Textarea
        id="notes"
        label="Note"
        placeholder="Note sul pagamento..."
        {...register('notes')}
        error={errors.notes?.message}
      />

      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Annulla
        </Button>
        <Button type="submit" loading={loading}>
          {initialData ? 'Aggiorna' : 'Registra'}
        </Button>
      </div>
    </form>
  )
}
