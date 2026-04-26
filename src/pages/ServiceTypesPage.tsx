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
  Tooltip,
  Skeleton,
  useToast,
} from '@/components/ui'
import ServiceTypeForm from '@/components/service-types/ServiceTypeForm'
import { ServiceTypeFormData } from '@/lib/schemas'
import { Database } from '@/types/database'

type ServiceType = Database['public']['Tables']['service_types']['Row']

export default function ServiceTypesPage() {
  const { toast } = useToast()
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
        toast.success('Prestazione aggiornata')
      } else {
        await createMutation.mutateAsync(data)
        toast.success('Prestazione creata', { description: data.name })
      }
      setModalOpen(false)
      setEditing(null)
    } catch (error) {
      toast.error('Salvataggio fallito', {
        description: error instanceof Error ? error.message : 'Riprova tra qualche istante',
      })
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await deleteMutation.mutateAsync(deleting.id)
      setDeleting(null)
      toast.success('Prestazione eliminata')
    } catch (error) {
      toast.error('Eliminazione fallita', {
        description: error instanceof Error ? error.message : 'Riprova tra qualche istante',
      })
    }
  }

  return (
    <div className="px-4 md:px-10 py-8 md:py-12 space-y-8 max-w-[1400px] mx-auto">
      <PageHeader
        eyebrow="Catalogo"
        title="Tipi di prestazione"
        description="Definisci tipologie con prezzo e durata. Servono per pianificare le sedute e calcolare gli incassi."
        action={
          <Button onClick={openCreateModal}>
            <Plus className="w-4 h-4" strokeWidth={2.25} />
            Nuova prestazione
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44 w-full bg-muted" />
          ))}
        </div>
      ) : serviceTypes.length === 0 ? (
        <Card variant="quiet">
          <EmptyState
            icon={Briefcase}
            tone="primary"
            title="Nessuna prestazione"
            description="Crea le tipologie usate nel tuo studio: individuale, coppia, famiglia, gruppo, e così via."
            action={
              <Button onClick={openCreateModal}>
                <Plus className="w-4 h-4" strokeWidth={2.25} />
                Crea prestazione
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {serviceTypes.map((item) => {
            const isPackage = item.type === 'package'
            return (
              <Card key={item.id} className="group">
                <div className="flex items-start justify-between mb-4">
                  <span
                    className={`inline-flex items-center gap-1.5 text-2xs uppercase tracking-wider font-semibold px-2 py-1 rounded-md ${
                      isPackage
                        ? 'bg-primary-soft text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <Briefcase className="w-3 h-3" strokeWidth={2} />
                    {isPackage ? 'Pacchetto' : 'Privato'}
                  </span>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Tooltip label="Modifica">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditModal(item)}
                        aria-label={`Modifica ${item.name}`}
                      >
                        <Edit className="w-4 h-4" strokeWidth={1.85} />
                      </Button>
                    </Tooltip>
                    <Tooltip label="Elimina">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleting(item)}
                        aria-label={`Elimina ${item.name}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" strokeWidth={1.85} />
                      </Button>
                    </Tooltip>
                  </div>
                </div>

                <h3 className="font-display text-xl font-semibold tracking-tight text-foreground mb-3 leading-tight">
                  {item.name}
                </h3>

                <div className="flex items-center gap-4 text-sm">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground tabular-nums">
                    <Clock className="w-3.5 h-3.5" strokeWidth={1.85} />
                    {item.duration_minutes} min
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-foreground tabular-nums">
                    <Euro className="w-3.5 h-3.5" strokeWidth={1.85} />
                    {Number(item.price).toFixed(2)}
                  </span>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Modifica prestazione' : 'Nuova prestazione'}
        description={editing ? 'Aggiorna nome, durata o tariffa.' : 'Imposta nome, durata, tariffa e tipologia.'}
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
        title="Eliminare la prestazione?"
        description={
          deleting
            ? `"${deleting.name}" verrà rimossa. Le sedute esistenti restano, ma non potrai pianificarne di nuove con questa prestazione.`
            : ''
        }
        confirmText="Elimina"
        destructive
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
