import { useState, useMemo } from 'react'
import { Plus, Search, Edit, Trash2, Mail, Phone, Users } from 'lucide-react'
import {
  usePatients,
  useCreatePatient,
  useUpdatePatient,
  useDeletePatient,
} from '@/hooks/usePatients'
import {
  Button,
  Input,
  Modal,
  Card,
  EmptyState,
  PageHeader,
  ConfirmDialog,
  Tooltip,
  Skeleton,
  useToast,
} from '@/components/ui'
import PatientForm from '@/components/patients/PatientForm'
import { PatientFormData } from '@/lib/schemas'
import { Database } from '@/types/database'

type Patient = Database['public']['Tables']['patients']['Row']

export default function PatientsPage() {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null)
  const [deletingPatient, setDeletingPatient] = useState<Patient | null>(null)

  const { data: patients = [], isLoading } = usePatients()
  const createMutation = useCreatePatient()
  const updateMutation = useUpdatePatient()
  const deleteMutation = useDeletePatient()

  const filteredPatients = useMemo(() => {
    if (!searchTerm) return patients
    const term = searchTerm.toLowerCase()
    return patients.filter(
      (p) =>
        p.first_name.toLowerCase().includes(term) ||
        p.last_name.toLowerCase().includes(term) ||
        p.email?.toLowerCase().includes(term) ||
        p.phone?.toLowerCase().includes(term)
    )
  }, [patients, searchTerm])

  const openCreateModal = () => {
    setEditingPatient(null)
    setModalOpen(true)
  }

  const openEditModal = (patient: Patient) => {
    setEditingPatient(patient)
    setModalOpen(true)
  }

  const handleSubmit = async (data: PatientFormData) => {
    try {
      const cleanData = {
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email || undefined,
        phone: data.phone || undefined,
        notes: data.notes || undefined,
      }

      if (editingPatient) {
        await updateMutation.mutateAsync({ id: editingPatient.id, updates: cleanData })
        toast.success('Paziente aggiornato', {
          description: `${cleanData.first_name} ${cleanData.last_name}`,
        })
      } else {
        await createMutation.mutateAsync(cleanData)
        toast.success('Paziente aggiunto', {
          description: `${cleanData.first_name} ${cleanData.last_name} è ora in carico`,
        })
      }
      setModalOpen(false)
      setEditingPatient(null)
    } catch (error) {
      toast.error('Salvataggio fallito', {
        description: error instanceof Error ? error.message : 'Riprova tra qualche istante',
      })
    }
  }

  const handleDelete = async () => {
    if (!deletingPatient) return
    const fullName = `${deletingPatient.first_name} ${deletingPatient.last_name}`
    try {
      await deleteMutation.mutateAsync(deletingPatient.id)
      setDeletingPatient(null)
      toast.success('Paziente eliminato', { description: fullName })
    } catch (error) {
      toast.error("Impossibile eliminare il paziente", {
        description: error instanceof Error ? error.message : 'Riprova tra qualche istante',
      })
    }
  }

  return (
    <div className="px-4 md:px-10 py-8 md:py-12 space-y-8 max-w-[1400px] mx-auto">
      <PageHeader
        eyebrow="Anagrafica"
        title="Pazienti"
        description="Gestisci nomi, contatti e note. La ricerca filtra in tempo reale per nome, email e telefono."
        action={
          <Button onClick={openCreateModal}>
            <Plus className="w-4 h-4" strokeWidth={2.25} />
            Nuovo paziente
          </Button>
        }
      />

      <Card padding="none">
        <div className="p-5 border-b border-border">
          <Input
            placeholder="Cerca per nome, email o telefono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon={<Search className="w-4 h-4" strokeWidth={1.85} />}
            aria-label="Cerca pazienti"
          />
        </div>

        {isLoading ? (
          <div className="p-5 space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full bg-muted" />
            ))}
          </div>
        ) : filteredPatients.length === 0 ? (
          <EmptyState
            icon={Users}
            tone={searchTerm ? 'neutral' : 'primary'}
            title={searchTerm ? 'Nessun risultato' : 'Nessun paziente'}
            description={
              searchTerm
                ? 'Prova a modificare i criteri di ricerca o cancella il filtro.'
                : 'Inizia aggiungendo il tuo primo paziente. Tutti i dati restano sempre tuoi.'
            }
            action={
              !searchTerm && (
                <Button onClick={openCreateModal}>
                  <Plus className="w-4 h-4" strokeWidth={2.25} />
                  Aggiungi paziente
                </Button>
              )
            }
          />
        ) : (
          <>
            {/* Desktop view */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-2xs uppercase tracking-wider text-muted-foreground font-semibold border-b border-border">
                    <th className="text-left py-3 px-5">Nome completo</th>
                    <th className="text-left py-3 px-5">Email</th>
                    <th className="text-left py-3 px-5">Telefono</th>
                    <th className="text-right py-3 px-5">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredPatients.map((patient) => (
                    <tr
                      key={patient.id}
                      className="text-foreground hover:bg-secondary/40 transition-colors"
                    >
                      <td className="py-3 px-5 font-medium">
                        {patient.last_name} {patient.first_name}
                      </td>
                      <td className="py-3 px-5 text-muted-foreground">
                        {patient.email || '—'}
                      </td>
                      <td className="py-3 px-5 text-muted-foreground tabular-nums">
                        {patient.phone || '—'}
                      </td>
                      <td className="py-3 px-5">
                        <div className="flex justify-end gap-1">
                          <Tooltip label="Modifica paziente" side="top">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditModal(patient)}
                              aria-label={`Modifica ${patient.first_name} ${patient.last_name}`}
                            >
                              <Edit className="w-4 h-4" strokeWidth={1.85} />
                            </Button>
                          </Tooltip>
                          <Tooltip label="Elimina paziente" side="top">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeletingPatient(patient)}
                              aria-label={`Elimina ${patient.first_name} ${patient.last_name}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" strokeWidth={1.85} />
                            </Button>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile view */}
            <ul className="md:hidden divide-y divide-border">
              {filteredPatients.map((patient) => (
                <li key={patient.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-foreground">
                      {patient.last_name} {patient.first_name}
                    </p>
                    <div className="flex gap-1 -mr-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditModal(patient)}
                        aria-label={`Modifica ${patient.first_name} ${patient.last_name}`}
                      >
                        <Edit className="w-4 h-4" strokeWidth={1.85} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingPatient(patient)}
                        aria-label={`Elimina ${patient.first_name} ${patient.last_name}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" strokeWidth={1.85} />
                      </Button>
                    </div>
                  </div>
                  {patient.email && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="w-3.5 h-3.5" strokeWidth={1.85} />
                      <span>{patient.email}</span>
                    </div>
                  )}
                  {patient.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground tabular-nums">
                      <Phone className="w-3.5 h-3.5" strokeWidth={1.85} />
                      <span>{patient.phone}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingPatient ? 'Modifica paziente' : 'Nuovo paziente'}
        description={
          editingPatient
            ? 'Aggiorna i dati anagrafici e le note.'
            : 'Inserisci i dati del paziente. Solo nome e cognome sono obbligatori.'
        }
        size="lg"
      >
        <PatientForm
          initialData={editingPatient || undefined}
          onSubmit={handleSubmit}
          onCancel={() => setModalOpen(false)}
          loading={createMutation.isPending || updateMutation.isPending}
        />
      </Modal>

      <ConfirmDialog
        isOpen={!!deletingPatient}
        onClose={() => setDeletingPatient(null)}
        onConfirm={handleDelete}
        title="Eliminare il paziente?"
        description={
          deletingPatient
            ? `${deletingPatient.last_name} ${deletingPatient.first_name} verrà rimosso insieme a tutte le sedute e i pagamenti collegati. L'azione non è reversibile.`
            : ''
        }
        confirmText="Elimina"
        destructive
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
