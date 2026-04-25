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

export default function PaymentsPage() {
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
    const totalDue = balances.reduce(
      (sum, b) => sum + (b.balance > 0 ? b.balance : 0),
      0
    )
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
      } else {
        await createMutation.mutateAsync(cleanData)
      }
      setModalOpen(false)
      setEditing(null)
      setDefaultPatientId(undefined)
    } catch (error) {
      console.error('Error saving payment:', error)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await deleteMutation.mutateAsync(deleting.id)
      setDeleting(null)
    } catch (error) {
      console.error('Error deleting payment:', error)
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      <PageHeader
        title="Pagamenti"
        description="Registra pagamenti e tieni traccia di arretrati e crediti"
        action={
          <Button onClick={() => openCreateModal()}>
            <Plus className="w-5 h-5" />
            Registra Pagamento
          </Button>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-start justify-between mb-2">
            <div className="p-2 rounded-lg bg-green-500/10 text-green-500">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Totale Incassato</p>
          <p className="text-2xl font-bold text-foreground">
            € {totals.totalCollected.toFixed(2)}
          </p>
        </Card>

        <Card>
          <div className="flex items-start justify-between mb-2">
            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500">
              <AlertCircle className="w-5 h-5" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Arretrati</p>
          <p className="text-2xl font-bold text-orange-500">
            € {totals.totalDue.toFixed(2)}
          </p>
        </Card>

        <Card>
          <div className="flex items-start justify-between mb-2">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Crediti Pazienti</p>
          <p className="text-2xl font-bold text-blue-500">
            € {totals.totalCredit.toFixed(2)}
          </p>
        </Card>
      </div>

      {/* Tabs */}
      <Card>
        <div className="flex gap-2 mb-6 flex-wrap">
          <Button
            variant={tab === 'payments' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setTab('payments')}
          >
            Storico Pagamenti
          </Button>
          <Button
            variant={tab === 'balances' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setTab('balances')}
          >
            Saldi Pazienti
          </Button>
        </div>

        {tab === 'payments' && (
          <>
            <div className="mb-6">
              <Input
                placeholder="Cerca pagamenti..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                icon={<Search className="w-5 h-5" />}
              />
            </div>

            {loadingPayments ? (
              <div className="text-center py-16 text-muted-foreground">
                Caricamento...
              </div>
            ) : filteredPayments.length === 0 ? (
              <EmptyState
                icon={CreditCard}
                title={searchTerm ? 'Nessun risultato' : 'Nessun pagamento'}
                description={
                  searchTerm
                    ? 'Prova a modificare i criteri di ricerca'
                    : 'Inizia registrando il tuo primo pagamento'
                }
                action={
                  !searchTerm && (
                    <Button onClick={() => openCreateModal()}>
                      <Plus className="w-5 h-5" />
                      Registra Pagamento
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
                        <th className="text-left py-3 px-4 font-medium">Data</th>
                        <th className="text-left py-3 px-4 font-medium">Paziente</th>
                        <th className="text-left py-3 px-4 font-medium">Metodo</th>
                        <th className="text-right py-3 px-4 font-medium">Importo</th>
                        <th className="text-right py-3 px-4 font-medium">Azioni</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredPayments.map((p) => (
                        <tr
                          key={p.id}
                          className="text-foreground hover:bg-secondary/50"
                        >
                          <td className="py-3 px-4">
                            {format(new Date(p.payment_date), 'd MMM yyyy', {
                              locale: it,
                            })}
                          </td>
                          <td className="py-3 px-4">
                            {p.patients
                              ? `${p.patients.last_name} ${p.patients.first_name}`
                              : '-'}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {paymentMethodLabels[
                              p.payment_method as keyof typeof paymentMethodLabels
                            ] || p.payment_method}
                          </td>
                          <td className="py-3 px-4 text-right font-semibold">
                            € {Number(p.amount).toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditModal(p)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleting(p)}
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
                  {filteredPayments.map((p) => (
                    <div
                      key={p.id}
                      className="border border-border rounded-lg p-4 space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-foreground">
                            € {Number(p.amount).toFixed(2)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(p.payment_date), 'd MMMM yyyy', {
                              locale: it,
                            })}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(p)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleting(p)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      {p.patients && (
                        <p className="text-sm">
                          {p.patients.last_name} {p.patients.first_name}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {paymentMethodLabels[
                          p.payment_method as keyof typeof paymentMethodLabels
                        ] || p.payment_method}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {tab === 'balances' && (
          <>
            {loadingBalances ? (
              <div className="text-center py-16 text-muted-foreground">
                Caricamento...
              </div>
            ) : balances.length === 0 ? (
              <EmptyState
                icon={CreditCard}
                title="Nessun saldo da mostrare"
                description="I saldi vengono calcolati in base alle sedute private e ai pagamenti registrati"
              />
            ) : (
              <div className="space-y-2">
                {balances.map((b) => (
                  <div
                    key={b.patientId}
                    className="border border-border rounded-lg p-4 hover:bg-secondary/30 transition-colors"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">
                          {b.patientName}
                        </p>
                        <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                          <span>{b.sessionsCount} sedute</span>
                          <span>·</span>
                          <span>Dovuto: € {b.totalDue.toFixed(2)}</span>
                          <span>·</span>
                          <span>Pagato: € {b.totalPaid.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">
                            {b.balance > 0
                              ? 'Arretrato'
                              : b.balance < 0
                                ? 'Credito paziente'
                                : 'Saldato'}
                          </p>
                          <p
                            className={`font-semibold flex items-center gap-1 ${
                              b.balance > 0
                                ? 'text-orange-500'
                                : b.balance < 0
                                  ? 'text-blue-500'
                                  : 'text-green-500'
                            }`}
                          >
                            {b.balance > 0 ? (
                              <TrendingUp className="w-4 h-4" />
                            ) : b.balance < 0 ? (
                              <TrendingDown className="w-4 h-4" />
                            ) : null}
                            € {Math.abs(b.balance).toFixed(2)}
                          </p>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openCreateModal(b.patientId)}
                        >
                          <Plus className="w-4 h-4" />
                          Registra
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
        title={editing ? 'Modifica Pagamento' : 'Registra Pagamento'}
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
        title="Elimina pagamento"
        description="Sei sicuro di voler eliminare questo pagamento?"
        confirmText="Elimina"
        destructive
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
