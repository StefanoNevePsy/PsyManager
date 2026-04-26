import { useState } from 'react'
import { Plus, Edit, Trash2, Building2, Package, Calendar } from 'lucide-react'
import {
  useStructures,
  useCreateStructure,
  useUpdateStructure,
  useDeleteStructure,
  usePackageAgreements,
  useCreatePackageAgreement,
  useUpdatePackageAgreement,
  useDeletePackageAgreement,
} from '@/hooks/useStructures'
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
import StructureForm from '@/components/structures/StructureForm'
import PackageAgreementForm from '@/components/structures/PackageAgreementForm'
import { StructureFormData, PackageAgreementFormData } from '@/lib/schemas'
import { Database } from '@/types/database'

type Structure = Database['public']['Tables']['structures']['Row']
type PackageAgreement = Database['public']['Tables']['package_agreements']['Row']

const eur = (n: number) =>
  n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function StructuresPage() {
  const { toast } = useToast()
  const [structureModalOpen, setStructureModalOpen] = useState(false)
  const [packageModalOpen, setPackageModalOpen] = useState(false)
  const [editingStructure, setEditingStructure] = useState<Structure | null>(null)
  const [editingPackage, setEditingPackage] = useState<PackageAgreement | null>(null)
  const [deletingStructure, setDeletingStructure] = useState<Structure | null>(null)
  const [deletingPackage, setDeletingPackage] = useState<PackageAgreement | null>(null)
  const [defaultStructureId, setDefaultStructureId] = useState<string | undefined>()

  const { data: structures = [], isLoading: loadingStructures } = useStructures()
  const { data: packages = [], isLoading: loadingPackages } = usePackageAgreements()

  const createStructure = useCreateStructure()
  const updateStructure = useUpdateStructure()
  const deleteStructure = useDeleteStructure()

  const createPackage = useCreatePackageAgreement()
  const updatePackage = useUpdatePackageAgreement()
  const deletePackage = useDeletePackageAgreement()

  const handleStructureSubmit = async (data: StructureFormData) => {
    try {
      const cleanData = { name: data.name, notes: data.notes || undefined }
      if (editingStructure) {
        await updateStructure.mutateAsync({ id: editingStructure.id, updates: cleanData })
        toast.success('Struttura aggiornata')
      } else {
        await createStructure.mutateAsync(cleanData)
        toast.success('Struttura aggiunta', { description: cleanData.name })
      }
      setStructureModalOpen(false)
      setEditingStructure(null)
    } catch (error) {
      toast.error('Salvataggio fallito', {
        description: error instanceof Error ? error.message : 'Riprova tra qualche istante',
      })
    }
  }

  const handlePackageSubmit = async (data: PackageAgreementFormData) => {
    try {
      const cleanData = {
        structure_id: data.structure_id,
        total_sessions: data.total_sessions,
        total_price: data.total_price,
        start_date: data.start_date,
        end_date: data.end_date || undefined,
      }
      if (editingPackage) {
        await updatePackage.mutateAsync({ id: editingPackage.id, updates: cleanData })
        toast.success('Pacchetto aggiornato')
      } else {
        await createPackage.mutateAsync(cleanData)
        toast.success('Pacchetto creato')
      }
      setPackageModalOpen(false)
      setEditingPackage(null)
      setDefaultStructureId(undefined)
    } catch (error) {
      toast.error('Salvataggio fallito', {
        description: error instanceof Error ? error.message : 'Riprova tra qualche istante',
      })
    }
  }

  return (
    <div className="px-4 md:px-10 py-8 md:py-12 space-y-10 max-w-[1400px] mx-auto">
      <PageHeader
        eyebrow="Convenzioni"
        title="Strutture e pacchetti"
        description="Gestisci centri convenzionati e accordi a forfait. Utili se collabori con cliniche o cooperative."
        action={
          <Button
            onClick={() => {
              setEditingStructure(null)
              setStructureModalOpen(true)
            }}
          >
            <Plus className="w-4 h-4" strokeWidth={2.25} />
            Nuova struttura
          </Button>
        }
      />

      {/* Structures Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-muted-foreground" strokeWidth={1.85} />
          <h2 className="font-display text-xl font-semibold tracking-tight">Strutture</h2>
        </div>

        {loadingStructures ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-44 w-full bg-muted" />
            ))}
          </div>
        ) : structures.length === 0 ? (
          <Card variant="quiet">
            <EmptyState
              icon={Building2}
              tone="primary"
              title="Nessuna struttura"
              description="Aggiungi i centri o le strutture per cui lavori a pacchetto."
              action={
                <Button
                  onClick={() => {
                    setEditingStructure(null)
                    setStructureModalOpen(true)
                  }}
                >
                  <Plus className="w-4 h-4" strokeWidth={2.25} />
                  Aggiungi struttura
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {structures.map((structure) => (
              <Card key={structure.id} className="group flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-9 h-9 rounded-md bg-primary-soft text-primary flex items-center justify-center">
                    <Building2 className="w-4 h-4" strokeWidth={2} />
                  </div>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Tooltip label="Modifica">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingStructure(structure)
                          setStructureModalOpen(true)
                        }}
                        aria-label={`Modifica ${structure.name}`}
                      >
                        <Edit className="w-4 h-4" strokeWidth={1.85} />
                      </Button>
                    </Tooltip>
                    <Tooltip label="Elimina">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingStructure(structure)}
                        aria-label={`Elimina ${structure.name}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" strokeWidth={1.85} />
                      </Button>
                    </Tooltip>
                  </div>
                </div>
                <h3 className="font-display text-lg font-semibold tracking-tight text-foreground mb-2">
                  {structure.name}
                </h3>
                {structure.notes && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2 leading-relaxed flex-1">
                    {structure.notes}
                  </p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-auto"
                  onClick={() => {
                    setEditingPackage(null)
                    setDefaultStructureId(structure.id)
                    setPackageModalOpen(true)
                  }}
                >
                  <Plus className="w-3.5 h-3.5" strokeWidth={2.25} />
                  Aggiungi pacchetto
                </Button>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Package Agreements Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-muted-foreground" strokeWidth={1.85} />
            <h2 className="font-display text-xl font-semibold tracking-tight">
              Pacchetti attivi
            </h2>
          </div>
          {structures.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingPackage(null)
                setDefaultStructureId(undefined)
                setPackageModalOpen(true)
              }}
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2.25} />
              Nuovo pacchetto
            </Button>
          )}
        </div>

        {loadingPackages ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-48 w-full bg-muted" />
            ))}
          </div>
        ) : packages.length === 0 ? (
          <Card variant="quiet">
            <EmptyState
              icon={Package}
              size="md"
              title="Nessun pacchetto attivo"
              description="I pacchetti sono accordi a forfait con strutture (es. 10 sedute al mese a € 500)."
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {packages.map((pkg) => {
              const progress =
                pkg.total_sessions > 0
                  ? (pkg.completed_sessions / pkg.total_sessions) * 100
                  : 0
              const remaining = Number(pkg.total_price) - Number(pkg.paid_amount)
              const settled = remaining <= 0

              return (
                <Card key={pkg.id} className="group">
                  <div className="flex items-start justify-between mb-4">
                    <div className="min-w-0">
                      <h3 className="font-display text-lg font-semibold tracking-tight text-foreground truncate">
                        {pkg.structures?.name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 tabular-nums">
                        <Calendar className="w-3 h-3" strokeWidth={1.85} />
                        <span>
                          {new Date(pkg.start_date).toLocaleDateString('it-IT')}
                          {pkg.end_date &&
                            ` → ${new Date(pkg.end_date).toLocaleDateString('it-IT')}`}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Tooltip label="Modifica">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingPackage(pkg)
                            setPackageModalOpen(true)
                          }}
                          aria-label="Modifica pacchetto"
                        >
                          <Edit className="w-4 h-4" strokeWidth={1.85} />
                        </Button>
                      </Tooltip>
                      <Tooltip label="Elimina">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingPackage(pkg)}
                          aria-label="Elimina pacchetto"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" strokeWidth={1.85} />
                        </Button>
                      </Tooltip>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-1.5 text-xs">
                        <span className="text-muted-foreground">Progresso sedute</span>
                        <span className="font-semibold tabular-nums">
                          {pkg.completed_sessions}/{pkg.total_sessions}
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-500 ease-out-quart"
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
                      <div>
                        <p className="text-2xs uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">
                          Totale
                        </p>
                        <p className="font-display text-lg font-semibold tabular-nums">
                          € {eur(Number(pkg.total_price))}
                        </p>
                      </div>
                      <div>
                        <p className="text-2xs uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">
                          {settled ? 'Saldato' : 'Da incassare'}
                        </p>
                        <p
                          className={`font-display text-lg font-semibold tabular-nums ${
                            settled ? 'text-success' : 'text-warning'
                          }`}
                        >
                          € {eur(Math.abs(remaining))}
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* Structure Modal */}
      <Modal
        isOpen={structureModalOpen}
        onClose={() => setStructureModalOpen(false)}
        title={editingStructure ? 'Modifica struttura' : 'Nuova struttura'}
        size="lg"
      >
        <StructureForm
          initialData={editingStructure || undefined}
          onSubmit={handleStructureSubmit}
          onCancel={() => setStructureModalOpen(false)}
          loading={createStructure.isPending || updateStructure.isPending}
        />
      </Modal>

      {/* Package Modal */}
      <Modal
        isOpen={packageModalOpen}
        onClose={() => {
          setPackageModalOpen(false)
          setDefaultStructureId(undefined)
        }}
        title={editingPackage ? 'Modifica pacchetto' : 'Nuovo pacchetto'}
        size="lg"
      >
        <PackageAgreementForm
          initialData={editingPackage || undefined}
          defaultStructureId={defaultStructureId}
          onSubmit={handlePackageSubmit}
          onCancel={() => {
            setPackageModalOpen(false)
            setDefaultStructureId(undefined)
          }}
          loading={createPackage.isPending || updatePackage.isPending}
        />
      </Modal>

      <ConfirmDialog
        isOpen={!!deletingStructure}
        onClose={() => setDeletingStructure(null)}
        onConfirm={async () => {
          if (!deletingStructure) return
          try {
            await deleteStructure.mutateAsync(deletingStructure.id)
            setDeletingStructure(null)
            toast.success('Struttura eliminata')
          } catch (error) {
            toast.error('Eliminazione fallita', {
              description: error instanceof Error ? error.message : 'Riprova',
            })
          }
        }}
        title="Eliminare la struttura?"
        description={
          deletingStructure
            ? `"${deletingStructure.name}" verrà rimossa, insieme a tutti i pacchetti associati. L'azione non è reversibile.`
            : ''
        }
        confirmText="Elimina"
        destructive
        loading={deleteStructure.isPending}
      />

      <ConfirmDialog
        isOpen={!!deletingPackage}
        onClose={() => setDeletingPackage(null)}
        onConfirm={async () => {
          if (!deletingPackage) return
          try {
            await deletePackage.mutateAsync(deletingPackage.id)
            setDeletingPackage(null)
            toast.success('Pacchetto eliminato')
          } catch (error) {
            toast.error('Eliminazione fallita', {
              description: error instanceof Error ? error.message : 'Riprova',
            })
          }
        }}
        title="Eliminare il pacchetto?"
        description="Il pacchetto verrà rimosso. L'azione non è reversibile."
        confirmText="Elimina"
        destructive
        loading={deletePackage.isPending}
      />
    </div>
  )
}
