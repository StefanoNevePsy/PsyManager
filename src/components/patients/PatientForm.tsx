import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { patientSchema, PatientFormData } from '@/lib/schemas'
import { Button, Input, Select, Textarea } from '@/components/ui'
import { usePatientGroups } from '@/hooks/usePatientGroups'
import { Database } from '@/types/database'

type Patient = Database['public']['Tables']['patients']['Row']

interface Props {
  initialData?: Patient
  onSubmit: (data: PatientFormData) => void | Promise<void>
  onCancel: () => void
  loading?: boolean
}

export default function PatientForm({
  initialData,
  onSubmit,
  onCancel,
  loading = false,
}: Props) {
  const { data: groups = [] } = usePatientGroups()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      first_name: initialData?.first_name || '',
      last_name: initialData?.last_name || '',
      email: initialData?.email || '',
      phone: initialData?.phone || '',
      notes: initialData?.notes || '',
      group_id: initialData?.group_id || '',
      group_role: initialData?.group_role || '',
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          id="first_name"
          label="Nome"
          required
          {...register('first_name')}
          error={errors.first_name?.message}
        />
        <Input
          id="last_name"
          label="Cognome"
          required
          {...register('last_name')}
          error={errors.last_name?.message}
        />
      </div>

      <Input
        id="email"
        label="Email"
        type="email"
        {...register('email')}
        error={errors.email?.message}
      />

      <Input
        id="phone"
        label="Telefono"
        type="tel"
        {...register('phone')}
        error={errors.phone?.message}
      />

      {/* Gruppo familiare / coppia */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border">
        <Select
          id="group_id"
          label="Gruppo familiare / coppia"
          hint="Opzionale: collega il paziente a un gruppo"
          {...register('group_id')}
          error={errors.group_id?.message}
          options={[
            { value: '', label: 'Nessun gruppo' },
            ...groups.map((g) => ({
              value: g.id,
              label: `${g.name} (${
                g.type === 'couple' ? 'coppia' : g.type === 'family' ? 'famiglia' : 'altro'
              })`,
            })),
          ]}
        />
        <Input
          id="group_role"
          label="Ruolo nel gruppo"
          placeholder="Es. madre, figlio, partner"
          {...register('group_role')}
          error={errors.group_role?.message}
        />
      </div>

      <Textarea
        id="notes"
        label="Note"
        {...register('notes')}
        error={errors.notes?.message}
        placeholder="Note sul paziente..."
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
