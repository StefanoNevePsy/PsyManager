import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { packageAgreementSchema, PackageAgreementFormData } from '@/lib/schemas'
import { Button, Input, Select } from '@/components/ui'
import { useStructures } from '@/hooks/useStructures'
import { Database } from '@/types/database'

type PackageAgreement = Database['public']['Tables']['package_agreements']['Row']

interface Props {
  initialData?: PackageAgreement
  defaultStructureId?: string
  onSubmit: (data: PackageAgreementFormData) => void | Promise<void>
  onCancel: () => void
  loading?: boolean
}

export default function PackageAgreementForm({
  initialData,
  defaultStructureId,
  onSubmit,
  onCancel,
  loading = false,
}: Props) {
  const { data: structures = [] } = useStructures()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PackageAgreementFormData>({
    resolver: zodResolver(packageAgreementSchema),
    defaultValues: {
      structure_id: initialData?.structure_id || defaultStructureId || '',
      total_sessions: initialData?.total_sessions || 10,
      total_price: initialData?.total_price || 0,
      start_date:
        initialData?.start_date || new Date().toISOString().split('T')[0],
      end_date: initialData?.end_date || '',
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Select
        id="structure_id"
        label="Struttura *"
        {...register('structure_id')}
        error={errors.structure_id?.message}
        options={[
          { value: '', label: 'Seleziona una struttura...' },
          ...structures.map((s) => ({ value: s.id, label: s.name })),
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          id="total_sessions"
          label="Numero di Sedute *"
          type="number"
          min={1}
          {...register('total_sessions', { valueAsNumber: true })}
          error={errors.total_sessions?.message}
        />

        <Input
          id="total_price"
          label="Prezzo Totale (€) *"
          type="number"
          step="0.01"
          min={0}
          {...register('total_price', { valueAsNumber: true })}
          error={errors.total_price?.message}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          id="start_date"
          label="Data Inizio *"
          type="date"
          {...register('start_date')}
          error={errors.start_date?.message}
        />

        <Input
          id="end_date"
          label="Data Fine"
          type="date"
          {...register('end_date')}
          error={errors.end_date?.message}
        />
      </div>

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
