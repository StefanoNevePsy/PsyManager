import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { BookOpen, Plus, Pencil, Trash2, Search, Filter } from 'lucide-react'
import {
  useClinicalNotes,
  useCreateClinicalNote,
  useUpdateClinicalNote,
  useDeleteClinicalNote,
  ClinicalNoteWithRelations,
} from '@/hooks/useClinicalNotes'
import { usePatients } from '@/hooks/usePatients'
import { ClinicalNoteFormData } from '@/lib/schemas'
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  Tooltip,
  useToast,
} from '@/components/ui'
import ClinicalNoteForm from '@/components/clinical-notes/ClinicalNoteForm'

export default function ClinicalNotesPage() {
  const { toast } = useToast()
  const { data: notes = [], isLoading } = useClinicalNotes()
  const { data: patients = [] } = usePatients()
  const createMutation = useCreateClinicalNote()
  const updateMutation = useUpdateClinicalNote()
  const deleteMutation = useDeleteClinicalNote()

  const [search, setSearch] = useState('')
  const [patientFilter, setPatientFilter] = useState('')
  const [editing, setEditing] = useState<ClinicalNoteWithRelations | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ClinicalNoteWithRelations | null>(null)

  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      if (patientFilter && n.patient_id !== patientFilter) return false
      if (!search) return true
      const text = search.toLowerCase()
      return (
        n.title?.toLowerCase().includes(text) ||
        n.content.toLowerCase().includes(text) ||
        `${n.patients?.last_name} ${n.patients?.first_name}`.toLowerCase().includes(text)
      )
    })
  }, [notes, search, patientFilter])

  const handleCreate = async (data: ClinicalNoteFormData) => {
    try {
      await createMutation.mutateAsync({
        patient_id: data.patient_id,
        session_id: data.session_id || null,
        title: data.title || null,
        content: data.content,
        note_date: data.note_date,
      })
      toast.success('Nota creata')
      setCreating(false)
    } catch (error) {
      toast.error('Errore nella creazione', {
        description: error instanceof Error ? error.message : 'Riprova',
      })
    }
  }

  const handleUpdate = async (data: ClinicalNoteFormData) => {
    if (!editing) return
    try {
      await updateMutation.mutateAsync({
        id: editing.id,
        updates: {
          patient_id: data.patient_id,
          session_id: data.session_id || null,
          title: data.title || null,
          content: data.content,
          note_date: data.note_date,
        },
      })
      toast.success('Nota aggiornata')
      setEditing(null)
    } catch (error) {
      toast.error('Errore nell\'aggiornamento', {
        description: error instanceof Error ? error.message : 'Riprova',
      })
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteMutation.mutateAsync(deleteTarget.id)
      toast.success('Nota eliminata')
      setDeleteTarget(null)
    } catch (error) {
      toast.error('Errore nell\'eliminazione', {
        description: error instanceof Error ? error.message : 'Riprova',
      })
    }
  }

  return (
    <div className="px-4 md:px-10 py-8 md:py-12 space-y-8 max-w-[1400px] mx-auto">
      <PageHeader
        eyebrow="Documentazione clinica"
        title="Diario clinico"
        description="Annota le tue osservazioni cliniche, organizzate per paziente e seduta."
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4" strokeWidth={2.25} />
            Nuova nota
          </Button>
        }
      />

      {/* Filters */}
      <Card padding="md">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Cerca"
            icon={<Search className="w-4 h-4" />}
            placeholder="Cerca per titolo, contenuto o paziente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            label="Filtra per paziente"
            value={patientFilter}
            onChange={(e) => setPatientFilter(e.target.value)}
            options={[
              { value: '', label: 'Tutti i pazienti' },
              ...patients.map((p) => ({
                value: p.id,
                label: `${p.last_name} ${p.first_name}`,
              })),
            ]}
          />
        </div>
      </Card>

      {/* Notes list */}
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full bg-muted" />
          ))}
        </div>
      ) : filteredNotes.length === 0 ? (
        <Card variant="quiet">
          <EmptyState
            icon={BookOpen}
            tone="primary"
            title={
              notes.length === 0
                ? 'Nessuna nota clinica'
                : 'Nessun risultato'
            }
            description={
              notes.length === 0
                ? 'Inizia ad annotare le tue osservazioni cliniche.'
                : search || patientFilter
                ? 'Prova a modificare i filtri di ricerca.'
                : ''
            }
            action={
              notes.length === 0 ? (
                <Button onClick={() => setCreating(true)}>
                  <Plus className="w-4 h-4" strokeWidth={2.25} />
                  Crea la prima nota
                </Button>
              ) : (search || patientFilter) ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch('')
                    setPatientFilter('')
                  }}
                >
                  <Filter className="w-4 h-4" />
                  Reset filtri
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <ul className="space-y-3">
          {filteredNotes.map((note) => (
            <Card key={note.id} padding="md" className="hover:border-foreground/15 transition-all">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-2xs uppercase tracking-wider text-muted-foreground font-semibold tabular-nums">
                      {format(new Date(note.note_date), 'EEEE d MMMM yyyy', { locale: it })}
                    </p>
                    {note.sessions && (
                      <span className="text-2xs px-1.5 py-0.5 rounded bg-primary-soft text-primary font-semibold">
                        Collegata a seduta
                      </span>
                    )}
                  </div>
                  {note.title && (
                    <h3 className="font-display text-lg font-semibold tracking-tight text-foreground mb-0.5">
                      {note.title}
                    </h3>
                  )}
                  {note.patients && (
                    <p className="text-sm text-muted-foreground">
                      {note.patients.last_name} {note.patients.first_name}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Tooltip label="Modifica">
                    <button
                      onClick={() => setEditing(note)}
                      className="p-2 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                      aria-label="Modifica nota"
                    >
                      <Pencil className="w-4 h-4" strokeWidth={1.85} />
                    </button>
                  </Tooltip>
                  <Tooltip label="Elimina">
                    <button
                      onClick={() => setDeleteTarget(note)}
                      className="p-2 rounded-md text-muted-foreground hover:bg-destructive-soft hover:text-destructive transition-colors"
                      aria-label="Elimina nota"
                    >
                      <Trash2 className="w-4 h-4" strokeWidth={1.85} />
                    </button>
                  </Tooltip>
                </div>
              </div>
              {(() => {
                const content = note.content || ''
                const isHtml = /<\/?[a-z][\s\S]*>/i.test(content)
                if (isHtml) {
                  return (
                    <div
                      className="prose prose-sm max-w-none text-foreground/85 dark:prose-invert prose-p:my-1 prose-headings:font-display prose-headings:font-semibold prose-headings:tracking-tight prose-blockquote:border-l-2 prose-blockquote:border-primary prose-blockquote:pl-3 prose-blockquote:italic prose-code:bg-secondary prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-2xs prose-code:before:content-none prose-code:after:content-none line-clamp-6"
                      dangerouslySetInnerHTML={{ __html: content }}
                    />
                  )
                }
                return (
                  <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap line-clamp-6">
                    {content}
                  </p>
                )
              })()}
            </Card>
          ))}
        </ul>
      )}

      {/* Create modal */}
      <Modal
        isOpen={creating}
        onClose={() => setCreating(false)}
        title="Nuova nota clinica"
        size="lg"
      >
        <ClinicalNoteForm
          onSubmit={handleCreate}
          onCancel={() => setCreating(false)}
          loading={createMutation.isPending}
        />
      </Modal>

      {/* Edit modal */}
      <Modal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        title="Modifica nota clinica"
        size="lg"
      >
        {editing && (
          <ClinicalNoteForm
            initialData={editing}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(null)}
            loading={updateMutation.isPending}
          />
        )}
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminare la nota?"
        description={`Stai per eliminare questa nota clinica${
          deleteTarget?.title ? ` "${deleteTarget.title}"` : ''
        }. Questa azione non può essere annullata.`}
        confirmText="Elimina"
        destructive
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
