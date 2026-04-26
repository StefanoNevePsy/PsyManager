import { useState, useMemo } from 'react'
import { Plus, Search, Edit, Trash2, Mail, Phone, Users, Heart, Home } from 'lucide-react'
import {
  usePatients,
  useCreatePatient,
  useUpdatePatient,
  useDeletePatient,
} from '@/hooks/usePatients'
import {
  usePatientGroups,
  useCreatePatientGroup,
  useUpdatePatientGroup,
  useDeletePatientGroup,
  PatientGroupWithMembers,
} from '@/hooks/usePatientGroups'
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
import PatientGroupForm from '@/components/patients/PatientGroupForm'
import { PatientFormData, PatientGroupFormData } from '@/lib/schemas'
import { Database } from '@/types/database'

type Patient = Database['public']['Tables']['patients']['Row']

export default function PatientsPage() {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null)
  const [deletingPatient, setDeletingPatient] = useState<Patient | null>(null)

  // Group management state
  const [groupModalOpen, setGroupModalOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<PatientGroupWithMembers | null>(null)
  const [deletingGroup, setDeletingGroup] = useState<PatientGroupWithMembers | null>(null)
  const [groupsListOpen, setGroupsListOpen] = useState(false)

  const { data: patients = [], isLoading } = usePatients()
  const { data: groups = [] } = usePatientGroups()
  const createMutation = useCreatePatient()
  const updateMutation = useUpdatePatient()
  const deleteMutation = useDeletePatient()
  const createGroupMutation = useCreatePatientGroup()
  const updateGroupMutation = useUpdatePatientGroup()
  const deleteGroupMutation = useDeletePatientGroup()

  const handleGroupSubmit = async (data: PatientGroupFormData) => {
    try {
      const payload = {
        name: data.name,
        type: data.type,
        notes: data.notes || null,
      }
      if (editingGroup) {
        await updateGroupMutation.mutateAsync({ id: editingGroup.id, updates: payload })
        toast.success('Gruppo aggiornato')
      } else {
        await createGroupMutation.mutateAsync(payload)
        toast.success('Gruppo creato')
      }
      setGroupModalOpen(false)
      setEditingGroup(null)
    } catch (error) {
      toast.error('Salvataggio fallito', {
        description: error instanceof Error ? error.message : 'Riprova',
      })
    }
  }

  const handleGroupDelete = async () => {
    if (!deletingGroup) return
    try {
      await deleteGroupMutation.mutateAsync(deletingGroup.id)
      toast.success('Gruppo eliminato', {
        description: 'I pazienti rimangono ma non sono più collegati al gruppo',
      })
      setDeletingGroup(null)
    } catch (error) {
      toast.error('Eliminazione fallita', {
        description: error instanceof Error ? error.message : 'Riprova',
      })
    }
  }

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
        group_id: data.group_id || null,
        group_role: data.group_role || null,
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
        description="Gestisci nomi, contatti, gruppi familiari/coppia e note."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setGroupsListOpen(true)}>
              <Users className="w-4 h-4" strokeWidth={2.25} />
              Gestisci gruppi
              {groups.length > 0 && (
                <span className="ml-1 text-2xs px-1.5 py-0.5 rounded bg-primary-soft text-primary tabular-nums font-semibold">
                  {groups.length}
                </span>
              )}
            </Button>
            <Button onClick={openCreateModal}>
              <Plus className="w-4 h-4" strokeWidth={2.25} />
              Nuovo paziente
            </Button>
          </div>
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
                  {filteredPatients.map((patient) => {
                    const group = groups.find((g) => g.id === patient.group_id)
                    return (
                    <tr
                      key={patient.id}
                      className="text-foreground hover:bg-secondary/40 transition-colors"
                    >
                      <td className="py-3 px-5 font-medium">
                        <div className="flex items-center gap-2">
                          <span>
                            {patient.last_name} {patient.first_name}
                          </span>
                          {group && (
                            <Tooltip
                              label={`${group.name}${
                                patient.group_role ? ` · ${patient.group_role}` : ''
                              }`}
                            >
                              <span className="inline-flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded bg-primary-soft text-primary font-semibold">
                                {group.type === 'couple' ? (
                                  <Heart className="w-3 h-3" strokeWidth={2.25} />
                                ) : group.type === 'family' ? (
                                  <Home className="w-3 h-3" strokeWidth={2.25} />
                                ) : (
                                  <Users className="w-3 h-3" strokeWidth={2.25} />
                                )}
                                <span className="truncate max-w-[100px]">{group.name}</span>
                              </span>
                            </Tooltip>
                          )}
                        </div>
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
                    )
                  })}
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

      {/* Lista gruppi */}
      <Modal
        isOpen={groupsListOpen}
        onClose={() => setGroupsListOpen(false)}
        title="Gruppi familiari e coppie"
        description="Raggruppa pazienti che condividono un percorso (coppie, famiglie). Assegna il gruppo dal form del paziente."
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => {
                setEditingGroup(null)
                setGroupModalOpen(true)
              }}
            >
              <Plus className="w-4 h-4" strokeWidth={2.25} />
              Nuovo gruppo
            </Button>
          </div>

          {groups.length === 0 ? (
            <EmptyState
              icon={Heart}
              size="sm"
              title="Nessun gruppo"
              description="Crea il primo gruppo per organizzare coppie o famiglie."
            />
          ) : (
            <ul className="space-y-2">
              {groups.map((g) => (
                <li
                  key={g.id}
                  className="flex items-start gap-3 p-3 rounded-md border border-border hover:border-foreground/15 transition-colors"
                >
                  <div className="flex-shrink-0 w-9 h-9 rounded-md bg-primary-soft text-primary flex items-center justify-center">
                    {g.type === 'couple' ? (
                      <Heart className="w-4 h-4" strokeWidth={2} />
                    ) : g.type === 'family' ? (
                      <Home className="w-4 h-4" strokeWidth={2} />
                    ) : (
                      <Users className="w-4 h-4" strokeWidth={2} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-medium text-sm text-foreground truncate">{g.name}</p>
                      <span className="text-2xs uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {g.type === 'couple' ? 'Coppia' : g.type === 'family' ? 'Famiglia' : 'Altro'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {g.members.length === 0
                        ? 'Nessun membro'
                        : g.members
                            .map((m) => `${m.first_name}${m.group_role ? ` (${m.group_role})` : ''}`)
                            .join(', ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Tooltip label="Modifica gruppo">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingGroup(g)
                          setGroupModalOpen(true)
                        }}
                      >
                        <Edit className="w-4 h-4" strokeWidth={1.85} />
                      </Button>
                    </Tooltip>
                    <Tooltip label="Elimina gruppo">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingGroup(g)}
                      >
                        <Trash2 className="w-4 h-4" strokeWidth={1.85} />
                      </Button>
                    </Tooltip>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>

      {/* Form gruppo */}
      <Modal
        isOpen={groupModalOpen}
        onClose={() => {
          setGroupModalOpen(false)
          setEditingGroup(null)
        }}
        title={editingGroup ? 'Modifica gruppo' : 'Nuovo gruppo'}
        size="md"
      >
        <PatientGroupForm
          initialData={editingGroup || undefined}
          onSubmit={handleGroupSubmit}
          onCancel={() => {
            setGroupModalOpen(false)
            setEditingGroup(null)
          }}
          loading={createGroupMutation.isPending || updateGroupMutation.isPending}
        />
      </Modal>

      <ConfirmDialog
        isOpen={!!deletingGroup}
        onClose={() => setDeletingGroup(null)}
        onConfirm={handleGroupDelete}
        title="Eliminare il gruppo?"
        description={
          deletingGroup
            ? `Il gruppo "${deletingGroup.name}" verrà eliminato. I pazienti associati rimarranno ma perderanno il collegamento al gruppo.`
            : ''
        }
        confirmText="Elimina"
        destructive
        loading={deleteGroupMutation.isPending}
      />
    </div>
  )
}
