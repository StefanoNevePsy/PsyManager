import { useState } from 'react'
import { Plus, Edit, Trash2, Briefcase, Clock, Euro } from 'lucide-react'
import {
  useServiceTypes,
  useCreateServiceType,
  useUpdateServiceType,
  useDeleteServiceType,
} from '@/hooks/useServiceTypes'
import {
  Button,
  Modal,
  Card,
  EmptyState,
  PageHeader,
  ConfirmDialog,
} from '@/components/ui'
import ServiceTypeForm from '@/components/service-types/ServiceTypeForm'
import { ServiceTypeFormData } from '@/lib/schemas'
import { Database } from '@/types/database'

type ServiceType = Database['public']['Tables']['service_types']['Row']

export default function ServiceTypesPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ServiceType | null>(null)
  const [deleting, setDeleting] = useState<ServiceType | null>(null)

  const { data: serviceTypes = [], isLoading } = useServiceTypes()
  const createMutation = useCreateServiceType()
  const updateMutation = useUpdateServiceType()
  const deleteMutation = useDeleteServiceType()

  const openCreateModal = () => {
    setEditing(null)
    setModalOpen(true)
  }

  const openEditModal = (item: ServiceType) => {
    setEditing(item)
    setModalOpen(true)
  }

  const handleSubmit = async (data: ServiceTypeFormData) => {
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, updates: data })
      } else {
        await createMutation.mutateAsync(data)
      }
      setModalOpen(false)
      setEditing(null)
    } catch (error) {
      console.error('Error saving service type:', error)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await deleteMutation.mutateAsync(deleting.id)
      setDeleting(null)
    } catch (error) {
      console.error('Error deleting service type:', error)
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <PageHeader
        title="Tipi di Prestazione"
        description="Definisci le tipologie di sedute con prezzi e durate personalizzate"
        action={
          <Button onClick={openCreateModal}>
            <Plus className="w-5 h-5" />
            Nuovo Tipo
          </Button>
        }
      />

      {isLoading ? (
        <Card>
          <div className="text-center py-16 text-muted-foreground">
            Caricamento...
          </div>
        </Card>
      ) : serviceTypes.length === 0 ? (
        <Card>
          <EmptyState
            icon={Briefcase}
            title="Nessun tipo di prestazione"
            description="Crea i tuoi tipi di prestazione per categorizzare le sedute (es. Individuale, Coppia, Famiglia, Gruppo)"
            action={
              <Button onClick={openCreateModal}>
                <Plus className="w-5 h-5" />
                Crea Tipo Prestazione
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {serviceTypes.map((item) => (
            <Card key={item.id}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div
                    className={`p-2 rounded-lg ${
                      item.type === 'private'
                        ? 'bg-blue-500/10 text-blue-500'
                        : 'bg-purple-500/10 text-purple-500'
                    }`}
                  >
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full ${
                      item.type === 'private'
                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                    }`}
                  >
                    {item.type === 'private' ? 'Privato' : 'Pacchetto'}
                  </span>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditModal(item)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleting(item)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>

              <h3 className="font-semibold text-foreground mb-3 text-lg">
                {item.name}
              </h3>

              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>{item.duration_minutes} minuti</span>
                </div>
                <div className="flex items-center gap-2">
                  <Euro className="w-4 h-4" />
                  <span className="font-semibold text-foreground">
                    € {Number(item.price).toFixed(2)}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Modifica Tipo Prestazione' : 'Nuovo Tipo Prestazione'}
        size="lg"
      >
        <ServiceTypeForm
          initialData={editing || undefined}
          onSubmit={handleSubmit}
          onCancel={() => setModalOpen(false)}
          loading={createMutation.isPending || updateMutation.isPending}
        />
      </Modal>

      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Elimina tipo prestazione"
        description={`Sei sicuro di voler eliminare "${deleting?.name}"? Le sedute esistenti che usano questo tipo non saranno cancellate, ma non potrai più creare nuove sedute con questo tipo.`}
        confirmText="Elimina"
        destructive
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
