import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { serviceTypeSchema, ServiceTypeFormData } from '@/lib/schemas'
import { Button, Input, Select } from '@/components/ui'
import { Database } from '@/types/database'

type ServiceType = Database['public']['Tables']['service_types']['Row']

interface Props {
  initialData?: ServiceType
  onSubmit: (data: ServiceTypeFormData) => void | Promise<void>
  onCancel: () => void
  loading?: boolean
}

export default function ServiceTypeForm({
  initialData,
  onSubmit,
  onCancel,
  loading = false,
}: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ServiceTypeFormData>({
    resolver: zodResolver(serviceTypeSchema),
    defaultValues: {
      name: initialData?.name || '',
      duration_minutes: initialData?.duration_minutes || 60,
      price: initialData?.price || 0,
      type: initialData?.type || 'private',
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        id="name"
        label="Nome Prestazione *"
        placeholder="es. Seduta Individuale, Terapia di Coppia, Gruppo Familiare"
        {...register('name')}
        error={errors.name?.message}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          id="duration_minutes"
          label="Durata (minuti) *"
          type="number"
          min={1}
          {...register('duration_minutes', { valueAsNumber: true })}
          error={errors.duration_minutes?.message}
        />

        <Input
          id="price"
          label="Prezzo (€) *"
          type="number"
          step="0.01"
          min={0}
          {...register('price', { valueAsNumber: true })}
          error={errors.price?.message}
        />
      </div>

      <Select
        id="type"
        label="Tipologia *"
        {...register('type')}
        error={errors.type?.message}
        options={[
          { value: 'private', label: 'Privato (paziente paga direttamente)' },
          { value: 'package', label: 'Pacchetto (struttura paga forfait)' },
        ]}
      />

      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Annulla
        </Button>
        <Button type="submit" loading={loading}>
          {initialData ? 'Aggiorna' : 'Crea'}
        </Button>
      </div>
    </form>
  )
}
