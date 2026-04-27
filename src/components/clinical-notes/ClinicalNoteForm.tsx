import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { clinicalNoteSchema, ClinicalNoteFormData } from '@/lib/schemas'
import { Button, Input, Select, RichTextEditor } from '@/components/ui'
import { usePatients } from '@/hooks/usePatients'
import { useSessions } from '@/hooks/useSessions'
import AttachmentList from '@/components/attachments/AttachmentList'
import { Database } from '@/types/database'

type ClinicalNote = Database['public']['Tables']['clinical_notes']['Row']

interface Props {
  initialData?: ClinicalNote
  defaultPatientId?: string
  defaultSessionId?: string
  onSubmit: (data: ClinicalNoteFormData) => void | Promise<void>
  onCancel: () => void
  loading?: boolean
}

export default function ClinicalNoteForm({
  initialData,
  defaultPatientId,
  defaultSessionId,
  onSubmit,
  onCancel,
  loading = false,
}: Props) {
  const { data: patients = [] } = usePatients()
  const { data: sessions = [] } = useSessions()

  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors },
  } = useForm<ClinicalNoteFormData>({
    resolver: zodResolver(clinicalNoteSchema),
    defaultValues: {
      patient_id: initialData?.patient_id || defaultPatientId || '',
      session_id: initialData?.session_id || defaultSessionId || '',
      title: initialData?.title || '',
      content: initialData?.content || '',
      note_date: initialData?.note_date || new Date().toISOString().split('T')[0],
    },
  })

  const selectedPatientId = watch('patient_id')
  const patientSessions = sessions.filter((s) => s.patient_id === selectedPatientId)

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Select
        id="patient_id"
        label="Paziente"
        required
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          id="note_date"
          label="Data"
          type="date"
          required
          {...register('note_date')}
          error={errors.note_date?.message}
        />

        {selectedPatientId && patientSessions.length > 0 && (
          <Select
            id="session_id"
            label="Seduta collegata"
            {...register('session_id')}
            error={errors.session_id?.message}
            hint="Opzionale"
            options={[
              { value: '', label: 'Nessuna seduta...' },
              ...patientSessions.map((s) => ({
                value: s.id,
                label: new Date(s.scheduled_at).toLocaleString('it-IT', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                }),
              })),
            ]}
          />
        )}
      </div>

      <Input
        id="title"
        label="Titolo"
        placeholder="Es. Prima seduta, Aggiornamento mensile..."
        hint="Opzionale"
        {...register('title')}
        error={errors.title?.message}
      />

      <div>
        <label className="block text-sm font-medium mb-1.5">
          Contenuto <span className="text-destructive">*</span>
        </label>
        <Controller
          name="content"
          control={control}
          render={({ field }) => (
            <RichTextEditor
              value={field.value}
              onChange={field.onChange}
              placeholder="Scrivi qui le tue note cliniche... Usa Markdown o le scorciatoie da tastiera"
              minHeight="240px"
              ariaLabel="Contenuto nota clinica"
            />
          )}
        />
        {errors.content?.message && (
          <p className="text-xs text-destructive mt-1">{errors.content.message}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1.5">
          Suggerimenti: <code className="text-2xs px-1 py-0.5 bg-secondary rounded">**grassetto**</code>{' '}
          <code className="text-2xs px-1 py-0.5 bg-secondary rounded">*corsivo*</code>{' '}
          <code className="text-2xs px-1 py-0.5 bg-secondary rounded">## Titolo</code>{' '}
          <code className="text-2xs px-1 py-0.5 bg-secondary rounded">- elenco</code>{' '}
          <code className="text-2xs px-1 py-0.5 bg-secondary rounded">{'> citazione'}</code>{' '}
          <code className="text-2xs px-1 py-0.5 bg-secondary rounded">[ ] task</code>
        </p>
      </div>

      {initialData?.id && (
        <div className="pt-4 border-t border-border">
          <AttachmentList
            ownerType="clinical_note"
            ownerId={initialData.id}
            description="Allega immagini, SVG di genogrammi o PDF (max 10 MB ciascuno)"
          />
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Annulla
        </Button>
        <Button type="submit" loading={loading}>
          {initialData ? 'Aggiorna' : 'Salva nota'}
        </Button>
      </div>
    </form>
  )
}
