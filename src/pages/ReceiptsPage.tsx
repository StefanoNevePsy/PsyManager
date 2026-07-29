import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { Plus, Receipt as ReceiptIcon, Edit, Trash2, Eye, Stamp, Settings2 } from 'lucide-react'
import {
  useReceipts,
  useReceiptSettings,
  useCreateReceipt,
  useUpdateReceipt,
  useDeleteReceipt,
  ReceiptWithRelations,
} from '@/hooks/useReceipts'
import {
  Button,
  Card,
  Modal,
  EmptyState,
  PageHeader,
  ConfirmDialog,
  Tooltip,
  Skeleton,
  Select,
  useToast,
} from '@/components/ui'
import ReceiptForm, { ReceiptFormOutput } from '@/components/receipts/ReceiptForm'
import ReceiptPrintView from '@/components/receipts/ReceiptPrintView'

const eur = (n: number) =>
  n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function ReceiptsPage() {
  const { toast } = useToast()
  const { data: receipts = [], isLoading } = useReceipts()
  const { data: settings } = useReceiptSettings()

  const createMutation = useCreateReceipt()
  const updateMutation = useUpdateReceipt()
  const deleteMutation = useDeleteReceipt()

  const [yearFilter, setYearFilter] = useState<string>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ReceiptWithRelations | null>(null)
  const [previewing, setPreviewing] = useState<ReceiptWithRelations | null>(null)
  const [deleting, setDeleting] = useState<ReceiptWithRelations | null>(null)

  const years = useMemo(() => {
    const set = new Set(receipts.map((r) => r.year))
    return Array.from(set).sort((a, b) => b - a)
  }, [receipts])

  const filteredReceipts = useMemo(() => {
    if (yearFilter === 'all') return receipts
    return receipts.filter((r) => String(r.year) === yearFilter)
  }, [receipts, yearFilter])

  const totals = useMemo(() => {
    const count = filteredReceipts.length
    const amount = filteredReceipts.reduce((sum, r) => sum + Number(r.amount), 0)
    return { count, amount }
  }, [filteredReceipts])

  const openCreateModal = () => {
    setEditing(null)
    setModalOpen(true)
  }

  const openEditModal = (receipt: ReceiptWithRelations) => {
    setEditing(receipt)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditing(null)
  }

  const handleSubmit = async (data: ReceiptFormOutput) => {
    try {
      const { sessionIds, ...receiptFields } = data
      if (editing) {
        await updateMutation.mutateAsync({
          id: editing.id,
          updates: receiptFields,
          sessionIds,
        })
        toast.success('Ricevuta aggiornata')
      } else {
        await createMutation.mutateAsync({ receipt: receiptFields, sessionIds })
        toast.success('Ricevuta creata', { description: `€ ${eur(receiptFields.amount)}` })
      }
      closeModal()
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
      toast.success('Ricevuta eliminata')
    } catch (error) {
      toast.error('Eliminazione fallita', {
        description: error instanceof Error ? error.message : 'Riprova tra qualche istante',
      })
    }
  }

  const recipientLabel = (r: ReceiptWithRelations) =>
    r.group_id ? r.patient_groups?.name || r.recipient_name : r.recipient_name

  const needsSetup = !isLoading && !settings?.professional_name

  return (
    <div className="px-4 md:px-10 py-8 md:py-12 space-y-8 max-w-[1400px] mx-auto">
      <PageHeader
        eyebrow="Fiscale"
        title="Ricevute"
        description="Emetti e archivia le ricevute sanitarie per le tue prestazioni."
        action={
          <Button onClick={openCreateModal}>
            <Plus className="w-4 h-4" strokeWidth={2.25} />
            Nuova ricevuta
          </Button>
        }
      />

      {needsSetup && (
        <Card variant="quiet" className="border-warning/20 bg-warning-soft/30">
          <div className="flex items-start gap-3">
            <Settings2 className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" strokeWidth={2} />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground">Dati professionali non configurati</p>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Prima di stampare una ricevuta, imposta nome, codice fiscale/P.IVA e albo in
                Impostazioni: compariranno automaticamente su ogni ricevuta.
              </p>
              <Link to="/settings">
                <Button variant="outline" size="sm" className="mt-3">
                  Vai a Impostazioni
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border rounded-lg overflow-hidden border border-border">
        <div className="bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <ReceiptIcon className="w-4 h-4 text-muted-foreground" strokeWidth={1.85} />
            <p className="text-xs text-muted-foreground">
              Ricevute {yearFilter === 'all' ? '(tutti gli anni)' : yearFilter}
            </p>
          </div>
          <p className="font-display text-3xl font-semibold tabular-nums tracking-tight leading-none">
            {totals.count}
          </p>
        </div>
        <div className="bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Stamp className="w-4 h-4 text-muted-foreground" strokeWidth={1.85} />
            <p className="text-xs text-muted-foreground">Importo totale</p>
          </div>
          <p className="font-display text-3xl font-semibold tabular-nums tracking-tight leading-none">
            <span className="text-base font-normal text-muted-foreground mr-1">€</span>
            {eur(totals.amount)}
          </p>
        </div>
      </div>

      <Card padding="none">
        <div className="flex items-center justify-between p-4 border-b border-border flex-wrap gap-3">
          <h2 className="font-display text-lg font-semibold tracking-tight">Elenco ricevute</h2>
          <div className="w-full sm:w-56">
            <Select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              aria-label="Filtra per anno"
              options={[
                { value: 'all', label: 'Tutti gli anni' },
                ...years.map((y) => ({ value: String(y), label: String(y) })),
              ]}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full bg-muted" />
            ))}
          </div>
        ) : filteredReceipts.length === 0 ? (
          <EmptyState
            icon={ReceiptIcon}
            tone="primary"
            title="Nessuna ricevuta"
            description="Crea la tua prima ricevuta sanitaria per un paziente o un gruppo."
            action={
              <Button onClick={openCreateModal}>
                <Plus className="w-4 h-4" strokeWidth={2.25} />
                Nuova ricevuta
              </Button>
            }
          />
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-2xs uppercase tracking-wider text-muted-foreground font-semibold border-b border-border">
                    <th className="text-left py-3 px-5">N°/Anno</th>
                    <th className="text-left py-3 px-5">Data</th>
                    <th className="text-left py-3 px-5">Destinatario</th>
                    <th className="text-right py-3 px-5">Importo</th>
                    <th className="text-right py-3 px-5">Bollo</th>
                    <th className="text-right py-3 px-5">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredReceipts.map((r) => (
                    <tr key={r.id} className="hover:bg-secondary/40 transition-colors">
                      <td className="py-3 px-5 text-foreground tabular-nums font-medium">
                        {r.number}/{r.year}
                      </td>
                      <td className="py-3 px-5 text-foreground tabular-nums">
                        {format(new Date(r.issue_date), 'd MMM yyyy', { locale: it })}
                      </td>
                      <td className="py-3 px-5 text-foreground">{recipientLabel(r)}</td>
                      <td className="py-3 px-5 text-right font-semibold tabular-nums text-foreground">
                        € {eur(Number(r.amount))}
                      </td>
                      <td className="py-3 px-5 text-right tabular-nums text-muted-foreground">
                        {Number(r.bollo_amount) > 0 ? `€ ${eur(Number(r.bollo_amount))}` : '—'}
                      </td>
                      <td className="py-3 px-5">
                        <div className="flex justify-end gap-1">
                          <Tooltip label="Anteprima e stampa">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setPreviewing(r)}
                              aria-label="Anteprima e stampa ricevuta"
                            >
                              <Eye className="w-4 h-4" strokeWidth={1.85} />
                            </Button>
                          </Tooltip>
                          <Tooltip label="Modifica ricevuta">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditModal(r)}
                              aria-label="Modifica ricevuta"
                            >
                              <Edit className="w-4 h-4" strokeWidth={1.85} />
                            </Button>
                          </Tooltip>
                          <Tooltip label="Elimina ricevuta">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleting(r)}
                              aria-label="Elimina ricevuta"
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

            <ul className="md:hidden divide-y divide-border">
              {filteredReceipts.map((r) => (
                <li key={r.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold tabular-nums text-foreground">
                        Ricevuta {r.number}/{r.year}
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {format(new Date(r.issue_date), 'd MMMM yyyy', { locale: it })}
                      </p>
                    </div>
                    <div className="flex gap-1 -mr-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setPreviewing(r)}
                        aria-label="Anteprima e stampa ricevuta"
                      >
                        <Eye className="w-4 h-4" strokeWidth={1.85} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditModal(r)}
                        aria-label="Modifica ricevuta"
                      >
                        <Edit className="w-4 h-4" strokeWidth={1.85} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleting(r)}
                        aria-label="Elimina ricevuta"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" strokeWidth={1.85} />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-foreground">{recipientLabel(r)}</p>
                  <p className="text-sm font-semibold tabular-nums text-foreground">
                    € {eur(Number(r.amount))}
                    {Number(r.bollo_amount) > 0 && (
                      <span className="text-xs font-normal text-muted-foreground ml-2">
                        + bollo € {eur(Number(r.bollo_amount))}
                      </span>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editing ? 'Modifica ricevuta' : 'Nuova ricevuta'}
        description={
          editing
            ? 'Aggiorna i dati della ricevuta.'
            : 'Compila i dati per emettere una nuova ricevuta sanitaria.'
        }
        size="lg"
      >
        <ReceiptForm
          initialData={editing || undefined}
          onSubmit={handleSubmit}
          onCancel={closeModal}
          loading={createMutation.isPending || updateMutation.isPending}
        />
      </Modal>

      <Modal
        isOpen={!!previewing}
        onClose={() => setPreviewing(null)}
        title={previewing ? `Ricevuta n. ${previewing.number}/${previewing.year}` : undefined}
        size="xl"
      >
        {previewing && <ReceiptPrintView receipt={previewing} settings={settings} />}
      </Modal>

      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Eliminare la ricevuta?"
        description="La ricevuta e i collegamenti alle sedute verranno rimossi. L'azione non è reversibile."
        confirmText="Elimina"
        destructive
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
