import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { structureSchema, StructureFormData } from '@/lib/schemas'
import { Button, Input, Textarea } from '@/components/ui'
import { Database } from '@/types/database'

type Structure = Database['public']['Tables']['structures']['Row']

interface Props {
  initialData?: Structure
  onSubmit: (data: StructureFormData) => void | Promise<void>
  onCancel: () => void
  loading?: boolean
}

export default function StructureForm({
  initialData,
  onSubmit,
  onCancel,
  loading = false,
}: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<StructureFormData>({
    resolver: zodResolver(structureSchema),
    defaultValues: {
      name: initialData?.name || '',
      notes: initialData?.notes || '',
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        id="name"
        label="Nome Struttura *"
        placeholder="es. Centro Psicologia Mediterranea"
        {...register('name')}
        error={errors.name?.message}
      />

      <Textarea
        id="notes"
        label="Note"
        placeholder="Indirizzo, contatti, accordi..."
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
