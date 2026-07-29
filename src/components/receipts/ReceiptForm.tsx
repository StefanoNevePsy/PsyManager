import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { AlertCircle, Receipt as ReceiptIcon } from 'lucide-react'
import { Button, Input, Select, Textarea } from '@/components/ui'
import { usePatients } from '@/hooks/usePatients'
import { usePatientGroups } from '@/hooks/usePatientGroups'
import { useSessions } from '@/hooks/useSessions'
import {
  useNextReceiptNumber,
  useReceiptSettings,
  useBilledSessionIds,
  ReceiptWithRelations,
} from '@/hooks/useReceipts'
import { patientFullName, isBillableStatus } from '@/lib/sessionDisplay'
import { PAYMENT_METHOD_LABELS } from '@/lib/netIncome'
import { paymentMethodEnum } from '@/lib/schemas'
import { PaymentMethod } from '@/types/database'

const eur = (n: number) =>
  n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// The recipient picker (recipient_ref) is a convenience to prefill
// recipient_name from a patient/group — it is not itself persisted, and
// "destinatario libero" (empty value) leaves recipient_name free text.
const receiptFormSchema = z.object({
  recipient_ref: z.string().optional().or(z.literal('')),
  recipient_name: z.string().min(1, 'Il destinatario è obbligatorio').max(200),
  recipient_tax_code: z.string().max(32).optional().or(z.literal('')),
  recipient_address: z.string().max(300).optional().or(z.literal('')),
  issue_date: z.string().min(1, 'La data è obbligatoria'),
  number: z
    .number({ message: 'Inserisci un numero valido' })
    .int()
    .min(1, 'Il numero deve essere maggiore di 0'),
  year: z.number().int().min(2000).max(2100),
  description: z.string().min(1, 'La descrizione è obbligatoria').max(300),
  amount: z
    .number({ message: 'Inserisci un importo valido' })
    .min(0.01, "L'importo deve essere maggiore di 0"),
  bollo_amount: z.number().min(0, 'Non può essere negativo'),
  payment_method: paymentMethodEnum.optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
})

type ReceiptFormFields = z.infer<typeof receiptFormSchema>

/** Shape handed to onSubmit: validated fields + the derived recipient link + picked sessions. */
export interface ReceiptFormOutput {
  patient_id: string | null
  group_id: string | null
  recipient_name: string
  recipient_tax_code: string | null
  recipient_address: string | null
  issue_date: string
  number: number
  year: number
  description: string
  amount: number
  bollo_amount: number
  payment_method: PaymentMethod | null
  notes: string | null
  sessionIds: string[]
}

interface Props {
  initialData?: ReceiptWithRelations
  onSubmit: (data: ReceiptFormOutput) => void | Promise<void>
  onCancel: () => void
  loading?: boolean
}

const parseRef = (
  ref: string | undefined | null
): { type: 'patient' | 'group' | null; id: string | null } => {
  if (!ref) return { type: null, id: null }
  const [type, id] = ref.split(':')
  if (type === 'patient' || type === 'group') return { type, id: id || null }
  return { type: null, id: null }
}

export default function ReceiptForm({ initialData, onSubmit, onCancel, loading = false }: Props) {
  const { data: patients = [] } = usePatients()
  const { data: groups = [] } = usePatientGroups()
  const { data: settings } = useReceiptSettings()
  const { data: billedSessionIds = new Set<string>() } = useBilledSessionIds()

  const initialRef = initialData?.patient_id
    ? `patient:${initialData.patient_id}`
    : initialData?.group_id
      ? `group:${initialData.group_id}`
      : ''

  const initialLinkedSessionIds = useMemo(
    () => new Set((initialData?.receipt_sessions ?? []).map((r) => r.session_id)),
    [initialData]
  )

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    getValues,
    control,
  } = useForm<ReceiptFormFields>({
    resolver: zodResolver(receiptFormSchema),
    defaultValues: {
      recipient_ref: initialRef,
      recipient_name: initialData?.recipient_name || '',
      recipient_tax_code: initialData?.recipient_tax_code || '',
      recipient_address: initialData?.recipient_address || '',
      issue_date: initialData?.issue_date || new Date().toISOString().split('T')[0],
      number: initialData?.number || 0,
      year: initialData?.year || new Date().getFullYear(),
      description: initialData?.description || 'Prestazione psicologica',
      amount: initialData?.amount ? Number(initialData.amount) : 0,
      bollo_amount: initialData?.bollo_amount ? Number(initialData.bollo_amount) : 0,
      payment_method: (initialData?.payment_method as ReceiptFormFields['payment_method']) || '',
      notes: initialData?.notes || '',
    },
  })

  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>(
    () => Array.from(initialLinkedSessionIds)
  )

  const recipientRef = useWatch({ control, name: 'recipient_ref' })
  const issueDate = useWatch({ control, name: 'issue_date' })
  const yearValue = useWatch({ control, name: 'year' })
  const amountValue = useWatch({ control, name: 'amount' })

  // Keep `year` in sync with the issue date — the receipt number is unique
  // per (user, year, number), so they must agree.
  useEffect(() => {
    if (!issueDate) return
    const y = new Date(issueDate).getFullYear()
    if (!Number.isNaN(y) && y !== getValues('year')) setValue('year', y)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueDate])

  // Suggest the next free number for the selected year, but never clobber a
  // number the user (or the loaded record) already set on purpose.
  const { data: nextNumber } = useNextReceiptNumber(yearValue)
  const lastSuggestedNumber = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (initialData) return // editing an existing receipt: keep its number
    if (nextNumber == null) return
    const current = getValues('number')
    if (lastSuggestedNumber.current === undefined || current === lastSuggestedNumber.current) {
      setValue('number', nextNumber)
    }
    lastSuggestedNumber.current = nextNumber
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextNumber, initialData])

  // Auto-fill recipient name from the selected patient/group.
  useEffect(() => {
    const { type, id } = parseRef(recipientRef)
    if (type === 'patient') {
      const p = patients.find((x) => x.id === id)
      if (p) setValue('recipient_name', patientFullName(p))
    } else if (type === 'group') {
      const g = groups.find((x) => x.id === id)
      if (g) setValue('recipient_name', g.name)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipientRef])

  // Marca da bollo: auto-set the default amount once the total crosses the
  // threshold, but stay editable — only overwrite while the field still
  // matches our own last suggestion (so a manual edit sticks).
  const bolloThreshold = settings ? Number(settings.bollo_threshold) : 77.47
  const bolloDefaultAmount = settings ? Number(settings.bollo_default_amount) : 2
  const lastAutoBollo = useRef<number | undefined>(undefined)
  useEffect(() => {
    const suggested = amountValue > bolloThreshold ? bolloDefaultAmount : 0
    const current = getValues('bollo_amount')
    if (lastAutoBollo.current === undefined || current === lastAutoBollo.current) {
      setValue('bollo_amount', suggested)
    }
    lastAutoBollo.current = suggested
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountValue, bolloThreshold, bolloDefaultAmount])

  // --- Session picker -----------------------------------------------------
  const twelveMonthsAgo = useMemo(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 12)
    return d
  }, [])
  const now = useMemo(() => new Date(), [])
  const { data: recentSessions = [] } = useSessions(twelveMonthsAgo, now)

  const { type: recipientType, id: recipientId } = parseRef(recipientRef)

  const candidateSessions = useMemo(() => {
    if (!recipientId) return []
    const nowMs = Date.now()
    return recentSessions
      .filter((s) => {
        const matches =
          recipientType === 'patient' ? s.patient_id === recipientId : s.group_id === recipientId
        if (!matches) return false
        if (!isBillableStatus(s.status)) return false
        if (new Date(s.scheduled_at).getTime() > nowMs) return false
        // Hide sessions already covered by ANOTHER receipt, but keep the
        // ones already linked to the receipt we're currently editing.
        if (billedSessionIds.has(s.id) && !initialLinkedSessionIds.has(s.id)) return false
        return true
      })
      .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
  }, [recentSessions, recipientType, recipientId, billedSessionIds, initialLinkedSessionIds])

  // Sessions no longer eligible (e.g. recipient changed) shouldn't linger selected.
  useEffect(() => {
    setSelectedSessionIds((prev) =>
      prev.filter((id) => candidateSessions.some((s) => s.id === id))
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipientId, recipientType])

  const toggleSession = (sessionId: string) => {
    setSelectedSessionIds((prev) => {
      const next = prev.includes(sessionId)
        ? prev.filter((id) => id !== sessionId)
        : [...prev, sessionId]

      if (next.length > 0) {
        const total = candidateSessions
          .filter((s) => next.includes(s.id))
          .reduce((sum, s) => sum + Number(s.service_types?.price ?? 0), 0)
        setValue('amount', Math.round(total * 100) / 100)
      }
      return next
    })
  }

  const showBolloHint = amountValue > bolloThreshold

  const submit = handleSubmit((data) => {
    const { type, id } = parseRef(data.recipient_ref)
    const output: ReceiptFormOutput = {
      patient_id: type === 'patient' ? id : null,
      group_id: type === 'group' ? id : null,
      recipient_name: data.recipient_name,
      recipient_tax_code: data.recipient_tax_code || null,
      recipient_address: data.recipient_address || null,
      issue_date: data.issue_date,
      number: data.number,
      year: data.year,
      description: data.description,
      amount: data.amount,
      bollo_amount: data.bollo_amount,
      payment_method: (data.payment_method as PaymentMethod) || null,
      notes: data.notes || null,
      sessionIds: selectedSessionIds,
    }
    return onSubmit(output)
  })

  return (
    <form onSubmit={submit} className="space-y-4">
      <Select
        id="recipient_ref"
        label="Destinatario"
        {...register('recipient_ref')}
        options={[
          { value: '', label: 'Destinatario libero (inserisci manualmente)' },
          ...patients.map((p) => ({ value: `patient:${p.id}`, label: `Paziente: ${patientFullName(p)}` })),
          ...groups.map((g) => ({ value: `group:${g.id}`, label: `Gruppo: ${g.name}` })),
        ]}
        hint="Seleziona un paziente o un gruppo per precompilare il nome, oppure lascia libero."
      />

      <Input
        id="recipient_name"
        label="Nome destinatario *"
        {...register('recipient_name')}
        error={errors.recipient_name?.message}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          id="recipient_tax_code"
          label="Codice fiscale"
          {...register('recipient_tax_code')}
          error={errors.recipient_tax_code?.message}
        />
        <Input
          id="recipient_address"
          label="Indirizzo"
          {...register('recipient_address')}
          error={errors.recipient_address?.message}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          id="issue_date"
          label="Data emissione *"
          type="date"
          {...register('issue_date')}
          error={errors.issue_date?.message}
        />
        <Input
          id="number"
          label="Numero ricevuta *"
          type="number"
          min={1}
          {...register('number', { valueAsNumber: true })}
          error={errors.number?.message}
          hint={`Anno ${yearValue || new Date().getFullYear()}`}
        />
      </div>

      {candidateSessions.length > 0 && (
        <div className="space-y-2">
          <p className="block text-sm font-medium text-foreground">
            Sedute non ancora fatturate ({candidateSessions.length})
          </p>
          <div className="border border-border rounded-lg divide-y divide-border max-h-56 overflow-y-auto">
            {candidateSessions.map((s) => (
              <label
                key={s.id}
                className="flex items-center gap-3 px-3.5 py-2.5 text-sm cursor-pointer hover:bg-secondary/40"
              >
                <input
                  type="checkbox"
                  checked={selectedSessionIds.includes(s.id)}
                  onChange={() => toggleSession(s.id)}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <span className="flex-1 min-w-0 truncate">
                  {format(new Date(s.scheduled_at), 'd MMM yyyy', { locale: it })} —{' '}
                  {s.service_types?.name}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  € {eur(Number(s.service_types?.price ?? 0))}
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Selezionando le sedute, l'importo viene calcolato automaticamente (resta modificabile).
          </p>
        </div>
      )}

      <Input
        id="description"
        label="Descrizione *"
        {...register('description')}
        error={errors.description?.message}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          id="amount"
          label="Importo (€) *"
          type="number"
          step="0.01"
          min={0.01}
          {...register('amount', { valueAsNumber: true })}
          error={errors.amount?.message}
        />
        <Input
          id="bollo_amount"
          label="Marca da bollo (€)"
          type="number"
          step="0.01"
          min={0}
          {...register('bollo_amount', { valueAsNumber: true })}
          error={errors.bollo_amount?.message}
        />
      </div>

      {showBolloHint && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-warning-soft border border-warning/20 text-warning">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={2.25} />
          <p className="text-sm leading-snug">
            Marca da bollo da € 2,00 obbligatoria per importi superiori a € 77,47.
          </p>
        </div>
      )}

      <Select
        id="payment_method"
        label="Metodo di pagamento"
        {...register('payment_method')}
        options={[
          { value: '', label: 'Non specificato' },
          ...Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => ({ value, label })),
        ]}
      />

      <Textarea
        id="notes"
        label="Note"
        placeholder="Note interne sulla ricevuta..."
        {...register('notes')}
        error={errors.notes?.message}
      />

      {!settings?.professional_name && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-primary-soft border border-primary/20 text-primary">
          <ReceiptIcon className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={2.25} />
          <p className="text-sm leading-snug">
            Non hai ancora configurato i tuoi dati professionali in Impostazioni: la ricevuta
            stampata risulterà incompleta.
          </p>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t border-border">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Annulla
        </Button>
        <Button type="submit" loading={loading}>
          {initialData ? 'Aggiorna' : 'Crea ricevuta'}
        </Button>
      </div>
    </form>
  )
}
