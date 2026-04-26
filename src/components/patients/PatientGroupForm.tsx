import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { patientGroupSchema, PatientGroupFormData } from '@/lib/schemas'
import { Button, Input, Select, Textarea } from '@/components/ui'
import { Database } from '@/types/database'

type PatientGroup = Database['public']['Tables']['patient_groups']['Row']

interface Props {
  initialData?: PatientGroup
  onSubmit: (data: PatientGroupFormData) => void | Promise<void>
  onCancel: () => void
  loading?: boolean
}

export default function PatientGroupForm({
  initialData,
  onSubmit,
  onCancel,
  loading = false,
}: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PatientGroupFormData>({
    resolver: zodResolver(patientGroupSchema),
    defaultValues: {
      name: initialData?.name || '',
      type: (initialData?.type as PatientGroupFormData['type']) || 'family',
      notes: initialData?.notes || '',
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        id="name"
        label="Nome del gruppo"
        required
        placeholder="Es. Famiglia Rossi, Coppia Bianchi & Verdi"
        {...register('name')}
        error={errors.name?.message}
      />

      <Select
        id="type"
        label="Tipo"
        required
        {...register('type')}
        error={errors.type?.message}
        options={[
          { value: 'family', label: 'Famiglia' },
          { value: 'couple', label: 'Coppia' },
          { value: 'other', label: 'Altro' },
        ]}
      />

      <Textarea
        id="notes"
        label="Note"
        placeholder="Note sul gruppo (dinamiche, contesto, etc.)"
        {...register('notes')}
        error={errors.notes?.message}
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
