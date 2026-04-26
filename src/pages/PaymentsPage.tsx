import { useState, useMemo } from 'react'
import {
  Plus,
  Search,
  Edit,
  Trash2,
  CreditCard,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Check,
} from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import {
  usePayments,
  useCreatePayment,
  useUpdatePayment,
  useDeletePayment,
  usePatientBalances,
  PaymentWithRelations,
} from '@/hooks/usePayments'
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
import PaymentForm from '@/components/payments/PaymentForm'
import { PaymentFormData } from '@/lib/schemas'

const paymentMethodLabels = {
  cash: 'Contanti',
  bank_transfer: 'Bonifico',
  credit_card: 'Carta',
  other: 'Altro',
}

type Tab = 'payments' | 'balances'

const eur = (n: number) =>
  n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function PaymentsPage() {
  const { toast } = useToast()
  const [tab, setTab] = useState<Tab>('payments')
  const [searchTerm, setSearchTerm] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<PaymentWithRelations | null>(null)
  const [deleting, setDeleting] = useState<PaymentWithRelations | null>(null)
  const [defaultPatientId, setDefaultPatientId] = useState<string | undefined>()

  const { data: payments = [], isLoading: loadingPayments } = usePayments()
  const { data: balances = [], isLoading: loadingBalances } = usePatientBalances()

  const createMutation = useCreatePayment()
  const updateMutation = useUpdatePayment()
  const deleteMutation = useDeletePayment()

  const filteredPayments = useMemo(() => {
    if (!searchTerm) return payments
    const term = searchTerm.toLowerCase()
    return payments.filter(
      (p) =>
        p.patients?.first_name.toLowerCase().includes(term) ||
        p.patients?.last_name.toLowerCase().includes(term) ||
        p.notes?.toLowerCase().includes(term)
    )
  }, [payments, searchTerm])

  const totals = useMemo(() => {
    const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount), 0)
    const totalDue = balances.reduce((sum, b) => sum + (b.balance > 0 ? b.balance : 0), 0)
    const totalCredit = balances.reduce(
      (sum, b) => sum + (b.balance < 0 ? Math.abs(b.balance) : 0),
      0
    )
    return { totalCollected, totalDue, totalCredit }
  }, [payments, balances])

  const openCreateModal = (patientId?: string) => {
    setEditing(null)
    setDefaultPatientId(patientId)
    setModalOpen(true)
  }

  const openEditModal = (payment: PaymentWithRelations) => {
    setEditing(payment)
    setDefaultPatientId(undefined)
    setModalOpen(true)
  }

  const handleSubmit = async (data: PaymentFormData) => {
    try {
      const cleanData = {
        patient_id: data.patient_id || undefined,
        session_id: data.session_id || undefined,
        amount: data.amount,
        payment_date: data.payment_date,
        payment_method: data.payment_method,
        notes: data.notes || undefined,
      }

      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, updates: cleanData })
        toast.success('Pagamento aggiornato')
      } else {
        await createMutation.mutateAsync(cleanData)
        toast.success('Pagamento registrato', {
          description: `€ ${eur(cleanData.amount)}`,
        })
      }
      setModalOpen(false)
      setEditing(null)
      setDefaultPatientId(undefined)
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
      toast.success('Pagamento eliminato')
    } catch (error) {
      toast.error('Eliminazione fallita', {
        description: error instanceof Error ? error.message : 'Riprova tra qualche istante',
      })
    }
  }

  return (
    <div className="px-4 md:px-10 py-8 md:py-12 space-y-8 max-w-[1400px] mx-auto">
      <PageHeader
        eyebrow="Cash flow"
        title="Pagamenti"
        description="Registra incassi e tieni sotto controllo arretrati e crediti dei tuoi pazienti."
        action={
          <Button onClick={() => openCreateModal()}>
            <Plus className="w-4 h-4" strokeWidth={2.25} />
            Registra pagamento
          </Button>
        }
      />

      {/* Three semantic indicators — same baseline color, semantic delta */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border rounded-lg overflow-hidden border border-border">
        <div className="bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="w-4 h-4 text-muted-foreground" strokeWidth={1.85} />
            <p className="text-xs text-muted-foreground">Totale incassato</p>
          </div>
          <p className="font-display text-3xl font-semibold tabular-nums tracking-tight leading-none">
            <span className="text-base font-normal text-muted-foreground mr-1">€</span>
            {eur(totals.totalCollected)}
          </p>
        </div>

        <div className="bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-warning" strokeWidth={2} />
            <p className="text-xs text-muted-foreground">Arretrati</p>
          </div>
          <p className="font-display text-3xl font-semibold tabular-nums tracking-tight leading-none text-warning">
            <span className="text-base font-normal opacity-60 mr-1">€</span>
            {eur(totals.totalDue)}
          </p>
        </div>

        <div className="bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-info" strokeWidth={1.85} />
            <p className="text-xs text-muted-foreground">Crediti pazienti</p>
          </div>
          <p className="font-display text-3xl font-semibold tabular-nums tracking-tight leading-none text-info">
            <span className="text-base font-normal opacity-60 mr-1">€</span>
            {eur(totals.totalCredit)}
          </p>
        </div>
      </div>

      <Card padding="none">
        <div className="flex items-center justify-between p-4 border-b border-border flex-wrap gap-3">
          <div className="inline-flex p-1 bg-muted rounded-lg">
            <button
              onClick={() => setTab('payments')}
              aria-pressed={tab === 'payments'}
              className={`px-3 h-8 rounded-md text-sm font-medium transition-all ${
                tab === 'payments'
                  ? 'bg-card text-foreground shadow-soft'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Storico
            </button>
            <button
              onClick={() => setTab('balances')}
              aria-pressed={tab === 'balances'}
              className={`px-3 h-8 rounded-md text-sm font-medium transition-all ${
                tab === 'balances'
                  ? 'bg-card text-foreground shadow-soft'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Saldi pazienti
            </button>
          </div>

          {tab === 'payments' && (
            <div className="w-full sm:w-72">
              <Input
                placeholder="Cerca..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                icon={<Search className="w-4 h-4" strokeWidth={1.85} />}
                aria-label="Cerca pagamenti"
              />
            </div>
          )}
        </div>

        {tab === 'payments' && (
          <>
            {loadingPayments ? (
              <div className="p-5 space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full bg-muted" />
                ))}
              </div>
            ) : filteredPayments.length === 0 ? (
              <EmptyState
                icon={CreditCard}
                tone={searchTerm ? 'neutral' : 'primary'}
                title={searchTerm ? 'Nessun risultato' : 'Nessun pagamento'}
                description={
                  searchTerm
                    ? 'Prova a modificare i criteri di ricerca.'
                    : 'Inizia registrando il tuo primo pagamento.'
                }
                action={
                  !searchTerm && (
                    <Button onClick={() => openCreateModal()}>
                      <Plus className="w-4 h-4" strokeWidth={2.25} />
                      Registra pagamento
                    </Button>
                  )
                }
              />
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-2xs uppercase tracking-wider text-muted-foreground font-semibold border-b border-border">
                        <th className="text-left py-3 px-5">Data</th>
                        <th className="text-left py-3 px-5">Paziente</th>
                        <th className="text-left py-3 px-5">Metodo</th>
                        <th className="text-right py-3 px-5">Importo</th>
                        <th className="text-right py-3 px-5">Azioni</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredPayments.map((p) => (
                        <tr key={p.id} className="hover:bg-secondary/40 transition-colors">
                          <td className="py-3 px-5 text-foreground tabular-nums">
                            {format(new Date(p.payment_date), 'd MMM yyyy', { locale: it })}
                          </td>
                          <td className="py-3 px-5 text-foreground">
                            {p.patients ? `${p.patients.last_name} ${p.patients.first_name}` : '—'}
                          </td>
                          <td className="py-3 px-5 text-muted-foreground">
                            {paymentMethodLabels[p.payment_method as keyof typeof paymentMethodLabels] || p.payment_method}
                          </td>
                          <td className="py-3 px-5 text-right font-semibold tabular-nums text-foreground">
                            € {eur(Number(p.amount))}
                          </td>
                          <td className="py-3 px-5">
                            <div className="flex justify-end gap-1">
                              <Tooltip label="Modifica pagamento">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => openEditModal(p)}
                                  aria-label="Modifica pagamento"
                                >
                                  <Edit className="w-4 h-4" strokeWidth={1.85} />
                                </Button>
                              </Tooltip>
                              <Tooltip label="Elimina pagamento">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeleting(p)}
                                  aria-label="Elimina pagamento"
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
                  {filteredPayments.map((p) => (
                    <li key={p.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold tabular-nums text-foreground">
                            € {eur(Number(p.amount))}
                          </p>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {format(new Date(p.payment_date), 'd MMMM yyyy', { locale: it })}
                          </p>
                        </div>
                        <div className="flex gap-1 -mr-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditModal(p)}
                            aria-label="Modifica pagamento"
                          >
                            <Edit className="w-4 h-4" strokeWidth={1.85} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleting(p)}
                            aria-label="Elimina pagamento"
                          >
                            <Trash2 className="w-4 h-4 text-destructive" strokeWidth={1.85} />
                          </Button>
                        </div>
                      </div>
                      {p.patients && (
                        <p className="text-sm text-foreground">
                          {p.patients.last_name} {p.patients.first_name}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {paymentMethodLabels[p.payment_method as keyof typeof paymentMethodLabels] || p.payment_method}
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}

        {tab === 'balances' && (
          <>
            {loadingBalances ? (
              <div className="p-5 space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-16 w-full bg-muted" />
                ))}
              </div>
            ) : balances.length === 0 ? (
              <EmptyState
                icon={CreditCard}
                title="Nessun saldo da mostrare"
                description="I saldi vengono calcolati in base alle sedute private e ai pagamenti registrati."
              />
            ) : (
              <ul className="divide-y divide-border">
                {balances.map((b) => {
                  const isArrear = b.balance > 0
                  const isCredit = b.balance < 0
                  return (
                    <li
                      key={b.patientId}
                      className="p-4 md:p-5 flex items-center gap-4 flex-wrap hover:bg-secondary/30 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{b.patientName}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1 tabular-nums">
                          <span>{b.sessionsCount} sedute</span>
                          <span>·</span>
                          <span>Dovuto: € {eur(b.totalDue)}</span>
                          <span>·</span>
                          <span>Pagato: € {eur(b.totalPaid)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-2xs uppercase tracking-wider text-muted-foreground font-semibold">
                            {isArrear ? 'Arretrato' : isCredit ? 'Credito' : 'Saldato'}
                          </p>
                          <p
                            className={`font-display font-semibold text-lg tabular-nums flex items-center gap-1 ${
                              isArrear ? 'text-warning' : isCredit ? 'text-info' : 'text-success'
                            }`}
                          >
                            {isArrear ? (
                              <TrendingUp className="w-4 h-4" strokeWidth={2} />
                            ) : isCredit ? (
                              <TrendingDown className="w-4 h-4" strokeWidth={2} />
                            ) : (
                              <Check className="w-4 h-4" strokeWidth={2.5} />
                            )}
                            € {eur(Math.abs(b.balance))}
                          </p>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openCreateModal(b.patientId)}
                          aria-label={`Registra pagamento per ${b.patientName}`}
                        >
                          <Plus className="w-3.5 h-3.5" strokeWidth={2.25} />
                          Registra
                        </Button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditing(null)
          setDefaultPatientId(undefined)
        }}
        title={editing ? 'Modifica pagamento' : 'Registra pagamento'}
        description={
          editing
            ? 'Aggiorna importo, data o metodo.'
            : "Importo, paziente, metodo e data dell'incasso."
        }
        size="lg"
      >
        <PaymentForm
          initialData={editing || undefined}
          defaultPatientId={defaultPatientId}
          onSubmit={handleSubmit}
          onCancel={() => {
            setModalOpen(false)
            setEditing(null)
            setDefaultPatientId(undefined)
          }}
          loading={createMutation.isPending || updateMutation.isPending}
        />
      </Modal>

      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Eliminare il pagamento?"
        description="Il pagamento verrà rimosso dallo storico. L'azione non è reversibile."
        confirmText="Elimina"
        destructive
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
