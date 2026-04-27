import { useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2, Phone, Mail } from 'lucide-react'
import { patientSchema, PatientFormData } from '@/lib/schemas'
import { Button, Input, Select, Textarea } from '@/components/ui'
import { usePatientGroups } from '@/hooks/usePatientGroups'
import { usePatientContacts } from '@/hooks/usePatientContacts'
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
  const { data: existingContacts = [] } = usePatientContacts(initialData?.id)

  const {
    register,
    control,
    handleSubmit,
    reset,
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
      contacts: [],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'contacts',
  })

  // Hydrate the contacts field array once existing contacts arrive
  useEffect(() => {
    if (existingContacts.length > 0 && fields.length === 0) {
      reset((current) => ({
        ...current,
        contacts: existingContacts.map((c) => ({
          id: c.id,
          kind: c.kind,
          label: c.label || '',
          value: c.value,
        })),
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingContacts.length])

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
        label="Email principale"
        type="email"
        {...register('email')}
        error={errors.email?.message}
        hint="Contatto email primario del paziente"
      />

      <Input
        id="phone"
        label="Telefono principale"
        type="tel"
        {...register('phone')}
        error={errors.phone?.message}
        hint="Numero di telefono primario"
      />

      {/* Additional contacts */}
      <div className="pt-2 border-t border-border space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Contatti aggiuntivi</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Aggiungi recapiti di familiari, riferimenti o numeri secondari (es. madre, padre,
              lavoro)
            </p>
          </div>
          <div className="flex gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => append({ kind: 'phone', label: '', value: '' })}
            >
              <Phone className="w-3.5 h-3.5" strokeWidth={2} />
              Telefono
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => append({ kind: 'email', label: '', value: '' })}
            >
              <Mail className="w-3.5 h-3.5" strokeWidth={2} />
              Email
            </Button>
          </div>
        </div>

        {fields.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Nessun contatto aggiuntivo</p>
        ) : (
          <ul className="space-y-2">
            {fields.map((field, index) => {
              const isPhone = field.kind === 'phone'
              return (
                <li
                  key={field.id}
                  className="flex items-start gap-2 p-3 rounded-md border border-border bg-secondary/30"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-md bg-card flex items-center justify-center text-muted-foreground border border-border mt-1">
                    {isPhone ? (
                      <Phone className="w-3.5 h-3.5" strokeWidth={2} />
                    ) : (
                      <Mail className="w-3.5 h-3.5" strokeWidth={2} />
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 flex-1 min-w-0">
                    <Input
                      placeholder="Etichetta (es. Madre, Lavoro)"
                      {...register(`contacts.${index}.label` as const)}
                    />
                    <Input
                      type={isPhone ? 'tel' : 'email'}
                      placeholder={isPhone ? 'Numero di telefono' : 'Indirizzo email'}
                      {...register(`contacts.${index}.value` as const)}
                      error={errors.contacts?.[index]?.value?.message}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    aria-label="Rimuovi contatto"
                    className="mt-1"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" strokeWidth={1.85} />
                  </Button>
                </li>
              )
            })}
          </ul>
        )}

        {fields.length === 0 && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => append({ kind: 'phone', label: '', value: '' })}
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
            Aggiungi contatto
          </Button>
        )}
      </div>

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
