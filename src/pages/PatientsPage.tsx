import { useState, useMemo } from 'react'
import { Plus, Search, Edit, Trash2, Mail, Phone, Users, Heart, Home, Tag, Pencil } from 'lucide-react'
import {
  usePatients,
  useCreatePatient,
  useUpdatePatient,
  useDeletePatient,
  PatientWithTags,
} from '@/hooks/usePatients'
import {
  usePatientGroups,
  useCreatePatientGroup,
  useUpdatePatientGroup,
  useDeletePatientGroup,
  PatientGroupWithMembers,
} from '@/hooks/usePatientGroups'
import { usePatientTags } from '@/hooks/usePatientTags'
import { usePatientTagAssignments } from '@/hooks/usePatientTagAssignments'
import { useReplacePatientContacts } from '@/hooks/usePatientContacts'
import { useReplaceFamilyMembers } from '@/hooks/usePatientFamilyMembers'
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
import PatientTagForm from '@/components/patient-tags/PatientTagForm'
import TagBadge from '@/components/patient-tags/TagBadge'
import TagSelector from '@/components/patient-tags/TagSelector'
import { PatientFormData, PatientGroupFormData, PatientTagFormData } from '@/lib/schemas'
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

  // Tag management state
  const [tagModalOpen, setTagModalOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<Database['public']['Tables']['patient_tags']['Row'] | null>(null)
  const [deletingTag, setDeletingTag] = useState<Database['public']['Tables']['patient_tags']['Row'] | null>(null)
  const [tagAssignmentOpen, setTagAssignmentOpen] = useState(false)
  const [assignmentPatient, setAssignmentPatient] = useState<PatientWithTags | null>(null)
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null)

  const { data: patients = [], isLoading } = usePatients()
  const { data: groups = [] } = usePatientGroups()
  const createMutation = useCreatePatient()
  const updateMutation = useUpdatePatient()
  const deleteMutation = useDeletePatient()
  const createGroupMutation = useCreatePatientGroup()
  const updateGroupMutation = useUpdatePatientGroup()
  const deleteGroupMutation = useDeletePatientGroup()

  // Tag hooks
  const { tags, createTag, updateTag, deleteTag, isCreating: isCreatingTag, isUpdating: isUpdatingTag, isDeleting: isDeletingTag } = usePatientTags()
  const { assignedTagIds: patientTagIds = [], toggleTag: togglePatientTag } = usePatientTagAssignments(assignmentPatient?.id)
  const replaceContactsMutation = useReplacePatientContacts()
  const replaceFamilyMutation = useReplaceFamilyMembers()

  const handleTagSubmit = async (data: PatientTagFormData) => {
    try {
      if (editingTag) {
        await updateTag({ id: editingTag.id, updates: data })
        toast.success('Tag aggiornato')
      } else {
        await createTag(data)
        toast.success('Tag creato')
      }
      setTagModalOpen(false)
      setEditingTag(null)
    } catch (error) {
      toast.error('Salvataggio fallito', {
        description: error instanceof Error ? error.message : 'Riprova',
      })
    }
  }

  const handleTagDelete = async () => {
    if (!deletingTag) return
    try {
      await deleteTag(deletingTag.id)
      toast.success('Tag eliminato')
      setDeletingTag(null)
    } catch (error) {
      toast.error('Eliminazione fallita', {
        description: error instanceof Error ? error.message : 'Riprova',
      })
    }
  }

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
    let results = patients

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      results = results.filter(
        (p) =>
          p.first_name.toLowerCase().includes(term) ||
          p.last_name.toLowerCase().includes(term) ||
          p.email?.toLowerCase().includes(term) ||
          p.phone?.toLowerCase().includes(term)
      )
    }

    // Filter by tag
    if (selectedTagFilter) {
      results = results.filter((p) =>
        p.patient_tags?.some((t) => t.id === selectedTagFilter)
      )
    }

    return results
  }, [patients, searchTerm, selectedTagFilter])

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

      const contacts = (data.contacts || [])
        .filter((c) => c.value && c.value.trim().length > 0)
        .map((c) => ({
          id: c.id,
          kind: c.kind,
          label: c.label || '',
          value: c.value.trim(),
        }))

      let patientId: string
      if (editingPatient) {
        await updateMutation.mutateAsync({ id: editingPatient.id, updates: cleanData })
        patientId = editingPatient.id
        toast.success('Paziente aggiornato', {
          description: `${cleanData.first_name} ${cleanData.last_name}`,
        })
      } else {
        const created = await createMutation.mutateAsync(cleanData)
        patientId = created.id
        toast.success('Paziente aggiunto', {
          description: `${cleanData.first_name} ${cleanData.last_name} è ora in carico`,
        })
      }

      // Sync additional contacts (delete removed, update existing, insert new)
      await replaceContactsMutation.mutateAsync({ patientId, contacts })

      // Sync family members (textual genogram)
      const familyMembers = (data.family_members || [])
        .filter((m) => m.relationship && m.relationship.trim().length > 0)
        .map((m) => ({
          id: m.id,
          relationship: m.relationship.trim(),
          full_name: (m.full_name || '').trim(),
          age: m.age ?? null,
          alive: m.alive,
          relationship_quality: (m.relationship_quality || '').trim() || null,
          notes: (m.notes || '').trim() || null,
        }))
      await replaceFamilyMutation.mutateAsync({ patientId, members: familyMembers })

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
            <Button variant="outline" onClick={() => setTagModalOpen(true)}>
              <Tag className="w-4 h-4" strokeWidth={2.25} />
              Gestisci tag
              {tags.length > 0 && (
                <span className="ml-1 text-2xs px-1.5 py-0.5 rounded bg-primary-soft text-primary tabular-nums font-semibold">
                  {tags.length}
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
        <div className="p-5 space-y-4 border-b border-border">
          <Input
            placeholder="Cerca per nome, email o telefono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon={<Search className="w-4 h-4" strokeWidth={1.85} />}
            aria-label="Cerca pazienti"
          />

          {tags.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filtra per tag</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedTagFilter(null)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    selectedTagFilter === null
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-foreground hover:bg-secondary/70'
                  }`}
                >
                  Tutti
                </button>
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => setSelectedTagFilter(tag.id)}
                    className={`transition-all ${
                      selectedTagFilter === tag.id ? 'opacity-100' : 'opacity-60 hover:opacity-80'
                    }`}
                  >
                    <TagBadge name={tag.name} color={tag.color} icon={tag.icon} />
                  </button>
                ))}
              </div>
            </div>
          )}
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
                    <th className="text-left py-3 px-5">Tag</th>
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
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="truncate">{patient.email || '—'}</span>
                          {(() => {
                            const extraEmails = (patient.patient_contacts || []).filter(
                              (c) => c.kind === 'email'
                            )
                            if (extraEmails.length === 0) return null
                            return (
                              <Tooltip
                                label={extraEmails
                                  .map((c) => `${c.label || 'Email'}: ${c.value}`)
                                  .join('\n')}
                              >
                                <span className="flex-shrink-0 text-2xs px-1.5 py-0.5 rounded bg-secondary text-foreground font-semibold">
                                  +{extraEmails.length}
                                </span>
                              </Tooltip>
                            )
                          })()}
                        </div>
                      </td>
                      <td className="py-3 px-5 text-muted-foreground tabular-nums">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="truncate">{patient.phone || '—'}</span>
                          {(() => {
                            const extraPhones = (patient.patient_contacts || []).filter(
                              (c) => c.kind === 'phone'
                            )
                            if (extraPhones.length === 0) return null
                            return (
                              <Tooltip
                                label={extraPhones
                                  .map((c) => `${c.label || 'Telefono'}: ${c.value}`)
                                  .join('\n')}
                              >
                                <span className="flex-shrink-0 text-2xs px-1.5 py-0.5 rounded bg-secondary text-foreground font-semibold">
                                  +{extraPhones.length}
                                </span>
                              </Tooltip>
                            )
                          })()}
                        </div>
                      </td>
                      <td className="py-3 px-5">
                        {patient.patient_tags && patient.patient_tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {patient.patient_tags.map((tag) => (
                              <TagBadge
                                key={tag.id}
                                name={tag.name}
                                color={tag.color}
                                icon={tag.icon}
                                size="sm"
                              />
                            ))}
                            <Tooltip label="Assegna tag">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                onClick={() => {
                                  setAssignmentPatient(patient)
                                  setTagAssignmentOpen(true)
                                }}
                              >
                                <Pencil className="w-3 h-3" strokeWidth={2} />
                              </Button>
                            </Tooltip>
                          </div>
                        ) : (
                          <Tooltip label="Assegna tag">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setAssignmentPatient(patient)
                                setTagAssignmentOpen(true)
                              }}
                            >
                              <Tag className="w-3 h-3" strokeWidth={2} />
                              Aggiungi tag
                            </Button>
                          </Tooltip>
                        )}
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
                  {(patient.patient_contacts || []).map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      {contact.kind === 'phone' ? (
                        <Phone className="w-3.5 h-3.5" strokeWidth={1.85} />
                      ) : (
                        <Mail className="w-3.5 h-3.5" strokeWidth={1.85} />
                      )}
                      <span className={contact.kind === 'phone' ? 'tabular-nums' : ''}>
                        {contact.value}
                      </span>
                      {contact.label && (
                        <span className="text-2xs px-1.5 py-0.5 rounded bg-secondary text-foreground font-semibold">
                          {contact.label}
                        </span>
                      )}
                    </div>
                  ))}
                  {patient.patient_tags && patient.patient_tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-2">
                      {patient.patient_tags.map((tag) => (
                        <TagBadge
                          key={tag.id}
                          name={tag.name}
                          color={tag.color}
                          icon={tag.icon}
                          size="sm"
                        />
                      ))}
                    </div>
                  )}
                  <div className="flex gap-1 pt-2 -ml-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setAssignmentPatient(patient)
                        setTagAssignmentOpen(true)
                      }}
                    >
                      <Tag className="w-3 h-3" strokeWidth={2} />
                      {patient.patient_tags && patient.patient_tags.length > 0 ? 'Modifica tag' : 'Aggiungi tag'}
                    </Button>
                  </div>
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

      {/* Tag management modal */}
      <Modal
        isOpen={tagModalOpen}
        onClose={() => {
          setTagModalOpen(false)
          setEditingTag(null)
        }}
        title="Gestisci tag"
        description="Crea e modifica i tag per categorizzare i tuoi pazienti"
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => {
                setEditingTag(null)
                setTagModalOpen(true)
              }}
            >
              <Plus className="w-4 h-4" strokeWidth={2.25} />
              Nuovo tag
            </Button>
          </div>

          {tags.length === 0 ? (
            <EmptyState
              icon={Tag}
              size="sm"
              title="Nessun tag"
              description="Crea il primo tag per organizzare i tuoi pazienti per categoria diagnostica o tipo di lavoro."
            />
          ) : (
            <ul className="space-y-2">
              {tags.map((tag) => (
                <li
                  key={tag.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-md border border-border hover:border-foreground/15 transition-colors"
                >
                  <TagBadge name={tag.name} color={tag.color} icon={tag.icon} />
                  <div className="flex gap-1 -mr-1">
                    <Tooltip label="Modifica tag">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingTag(tag)
                          setTagModalOpen(true)
                        }}
                      >
                        <Pencil className="w-4 h-4" strokeWidth={1.85} />
                      </Button>
                    </Tooltip>
                    <Tooltip label="Elimina tag">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingTag(tag)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" strokeWidth={1.85} />
                      </Button>
                    </Tooltip>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>

      {/* Tag creation/edit form */}
      <Modal
        isOpen={tagModalOpen && editingTag === null}
        onClose={() => setEditingTag(null)}
        title="Nuovo tag"
        size="md"
      >
        <PatientTagForm
          onSubmit={handleTagSubmit}
          onCancel={() => {
            setTagModalOpen(false)
            setEditingTag(null)
          }}
          loading={isCreatingTag}
        />
      </Modal>

      {/* Tag edit form */}
      <Modal
        isOpen={editingTag !== null}
        onClose={() => setEditingTag(null)}
        title="Modifica tag"
        size="md"
      >
        {editingTag && (
          <PatientTagForm
            initialData={editingTag}
            onSubmit={handleTagSubmit}
            onCancel={() => {
              setTagModalOpen(true)
              setEditingTag(null)
            }}
            loading={isUpdatingTag}
          />
        )}
      </Modal>

      {/* Tag assignment modal */}
      <Modal
        isOpen={tagAssignmentOpen}
        onClose={() => {
          setTagAssignmentOpen(false)
          setAssignmentPatient(null)
        }}
        title={`Assegna tag a ${assignmentPatient ? `${assignmentPatient.first_name} ${assignmentPatient.last_name}` : ''}`}
        size="md"
      >
        {assignmentPatient && (
          <TagSelector
            selectedTagIds={patientTagIds}
            onTagToggle={togglePatientTag}
            onCreateClick={() => {
              setTagAssignmentOpen(false)
              setTagModalOpen(true)
            }}
          />
        )}
      </Modal>

      {/* Tag deletion confirmation */}
      <ConfirmDialog
        isOpen={!!deletingTag}
        onClose={() => setDeletingTag(null)}
        onConfirm={handleTagDelete}
        title="Eliminare il tag?"
        description={
          deletingTag
            ? `Il tag "${deletingTag.name}" verrà eliminato. Verrà rimosso da tutti i pazienti.`
            : ''
        }
        confirmText="Elimina"
        destructive
        loading={isDeletingTag}
      />
    </div>
  )
}
