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
} from '@/components/ui'
import StructureForm from '@/components/structures/StructureForm'
import PackageAgreementForm from '@/components/structures/PackageAgreementForm'
import {
  StructureFormData,
  PackageAgreementFormData,
} from '@/lib/schemas'
import { Database } from '@/types/database'

type Structure = Database['public']['Tables']['structures']['Row']
type PackageAgreement = Database['public']['Tables']['package_agreements']['Row']

export default function StructuresPage() {
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
      const cleanData = {
        name: data.name,
        notes: data.notes || undefined,
      }
      if (editingStructure) {
        await updateStructure.mutateAsync({
          id: editingStructure.id,
          updates: cleanData,
        })
      } else {
        await createStructure.mutateAsync(cleanData)
      }
      setStructureModalOpen(false)
      setEditingStructure(null)
    } catch (error) {
      console.error(error)
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
        await updatePackage.mutateAsync({
          id: editingPackage.id,
          updates: cleanData,
        })
      } else {
        await createPackage.mutateAsync(cleanData)
      }
      setPackageModalOpen(false)
      setEditingPackage(null)
      setDefaultStructureId(undefined)
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <PageHeader
        title="Strutture e Pacchetti"
        description="Gestisci centri e accordi di pacchetto forfettari"
        action={
          <Button
            onClick={() => {
              setEditingStructure(null)
              setStructureModalOpen(true)
            }}
          >
            <Plus className="w-5 h-5" />
            Nuova Struttura
          </Button>
        }
      />

      {/* Structures Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Strutture</h2>
        </div>

        {loadingStructures ? (
          <Card>
            <div className="text-center py-8 text-muted-foreground">
              Caricamento...
            </div>
          </Card>
        ) : structures.length === 0 ? (
          <Card>
            <EmptyState
              icon={Building2}
              title="Nessuna struttura"
              description="Aggiungi i centri o le strutture per cui lavori a pacchetto"
              action={
                <Button
                  onClick={() => {
                    setEditingStructure(null)
                    setStructureModalOpen(true)
                  }}
                >
                  <Plus className="w-5 h-5" />
                  Aggiungi Struttura
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {structures.map((structure) => (
              <Card key={structure.id}>
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingStructure(structure)
                        setStructureModalOpen(true)
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeletingStructure(structure)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <h3 className="font-semibold text-foreground text-lg mb-2">
                  {structure.name}
                </h3>
                {structure.notes && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {structure.notes}
                  </p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setEditingPackage(null)
                    setDefaultStructureId(structure.id)
                    setPackageModalOpen(true)
                  }}
                >
                  <Plus className="w-4 h-4" />
                  Aggiungi Pacchetto
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Package Agreements Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Pacchetti Attivi</h2>
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
              <Plus className="w-4 h-4" />
              Nuovo Pacchetto
            </Button>
          )}
        </div>

        {loadingPackages ? (
          <Card>
            <div className="text-center py-8 text-muted-foreground">
              Caricamento...
            </div>
          </Card>
        ) : packages.length === 0 ? (
          <Card>
            <EmptyState
              icon={Package}
              title="Nessun pacchetto"
              description="I pacchetti sono accordi a forfait con le strutture (es. 10 sedute al mese a € 500)"
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {packages.map((pkg) => {
              const progress = pkg.total_sessions > 0
                ? (pkg.completed_sessions / pkg.total_sessions) * 100
                : 0
              const remaining = Number(pkg.total_price) - Number(pkg.paid_amount)

              return (
                <Card key={pkg.id}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-foreground">
                        {pkg.structures?.name}
                      </h3>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {new Date(pkg.start_date).toLocaleDateString('it-IT')}
                          {pkg.end_date &&
                            ` → ${new Date(pkg.end_date).toLocaleDateString('it-IT')}`}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingPackage(pkg)
                          setPackageModalOpen(true)
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingPackage(pkg)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-muted-foreground">Progresso sedute</span>
                        <span className="font-medium">
                          {pkg.completed_sessions}/{pkg.total_sessions}
                        </span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                      <div>
                        <p className="text-xs text-muted-foreground">Totale</p>
                        <p className="font-semibold">
                          € {Number(pkg.total_price).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {remaining > 0 ? 'Da incassare' : 'Saldato'}
                        </p>
                        <p
                          className={`font-semibold ${
                            remaining > 0 ? 'text-orange-500' : 'text-green-500'
                          }`}
                        >
                          € {Math.abs(remaining).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Structure Modal */}
      <Modal
        isOpen={structureModalOpen}
        onClose={() => setStructureModalOpen(false)}
        title={editingStructure ? 'Modifica Struttura' : 'Nuova Struttura'}
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
        title={editingPackage ? 'Modifica Pacchetto' : 'Nuovo Pacchetto'}
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

      {/* Confirm Delete Structure */}
      <ConfirmDialog
        isOpen={!!deletingStructure}
        onClose={() => setDeletingStructure(null)}
        onConfirm={async () => {
          if (deletingStructure) {
            await deleteStructure.mutateAsync(deletingStructure.id)
            setDeletingStructure(null)
          }
        }}
        title="Elimina struttura"
        description={`Sei sicuro di voler eliminare "${deletingStructure?.name}"? Tutti i pacchetti associati verranno cancellati.`}
        confirmText="Elimina"
        destructive
        loading={deleteStructure.isPending}
      />

      {/* Confirm Delete Package */}
      <ConfirmDialog
        isOpen={!!deletingPackage}
        onClose={() => setDeletingPackage(null)}
        onConfirm={async () => {
          if (deletingPackage) {
            await deletePackage.mutateAsync(deletingPackage.id)
            setDeletingPackage(null)
          }
        }}
        title="Elimina pacchetto"
        description="Sei sicuro di voler eliminare questo pacchetto?"
        confirmText="Elimina"
        destructive
        loading={deletePackage.isPending}
      />
    </div>
  )
}
