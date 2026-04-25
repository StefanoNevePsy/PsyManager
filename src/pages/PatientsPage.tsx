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
} from '@/components/ui'
import PatientForm from '@/components/patients/PatientForm'
import { PatientFormData } from '@/lib/schemas'
import { Database } from '@/types/database'

type Patient = Database['public']['Tables']['patients']['Row']

export default function PatientsPage() {
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
        await updateMutation.mutateAsync({
          id: editingPatient.id,
          updates: cleanData,
        })
      } else {
        await createMutation.mutateAsync(cleanData)
      }
      setModalOpen(false)
      setEditingPatient(null)
    } catch (error) {
      console.error('Error saving patient:', error)
    }
  }

  const handleDelete = async () => {
    if (!deletingPatient) return
    try {
      await deleteMutation.mutateAsync(deletingPatient.id)
      setDeletingPatient(null)
    } catch (error) {
      console.error('Error deleting patient:', error)
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <PageHeader
        title="Pazienti"
        description="Gestisci l'anagrafe dei tuoi pazienti"
        action={
          <Button onClick={openCreateModal}>
            <Plus className="w-5 h-5" />
            Nuovo Paziente
          </Button>
        }
      />

      <Card>
        <div className="mb-6">
          <Input
            placeholder="Cerca per nome, email o telefono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon={<Search className="w-5 h-5" />}
          />
        </div>

        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">
            Caricamento...
          </div>
        ) : filteredPatients.length === 0 ? (
          <EmptyState
            icon={Users}
            title={searchTerm ? 'Nessun risultato' : 'Nessun paziente'}
            description={
              searchTerm
                ? 'Prova a modificare i criteri di ricerca'
                : 'Inizia aggiungendo il tuo primo paziente'
            }
            action={
              !searchTerm && (
                <Button onClick={openCreateModal}>
                  <Plus className="w-5 h-5" />
                  Aggiungi Paziente
                </Button>
              )
            }
          />
        ) : (
          <>
            {/* Desktop view */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr className="text-muted-foreground">
                    <th className="text-left py-3 px-4 font-medium">Nome Completo</th>
                    <th className="text-left py-3 px-4 font-medium">Email</th>
                    <th className="text-left py-3 px-4 font-medium">Telefono</th>
                    <th className="text-right py-3 px-4 font-medium">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredPatients.map((patient) => (
                    <tr
                      key={patient.id}
                      className="text-foreground hover:bg-secondary/50 transition-colors"
                    >
                      <td className="py-3 px-4 font-medium">
                        {patient.last_name} {patient.first_name}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {patient.email || '-'}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {patient.phone || '-'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(patient)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingPatient(patient)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile view */}
            <div className="md:hidden space-y-3">
              {filteredPatients.map((patient) => (
                <div
                  key={patient.id}
                  className="border border-border rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-foreground">
                        {patient.last_name} {patient.first_name}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditModal(patient)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingPatient(patient)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {patient.email && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="w-4 h-4" />
                      <span>{patient.email}</span>
                    </div>
                  )}
                  {patient.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="w-4 h-4" />
                      <span>{patient.phone}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingPatient ? 'Modifica Paziente' : 'Nuovo Paziente'}
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
        title="Elimina paziente"
        description={`Sei sicuro di voler eliminare ${deletingPatient?.last_name} ${deletingPatient?.first_name}? Questa azione non può essere annullata e cancellerà anche tutte le sedute e i pagamenti associati.`}
        confirmText="Elimina"
        destructive
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
