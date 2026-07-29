import { useEffect, useState } from 'react'
import { Save, Receipt } from 'lucide-react'
import { useReceiptSettings, useUpdateReceiptSettings } from '@/hooks/useReceipts'
import { Button, Card, Input, Textarea, useToast } from '@/components/ui'

const DEFAULT_REGIME_NOTE =
  "Operazione effettuata ai sensi dell'art. 1, commi 54-89, L. 190/2014 - Regime forfettario. Non soggetta a ritenuta d'acconto."
const DEFAULT_EXEMPT_NOTE = 'Esente IVA art. 10 n. 18 DPR 633/72'

interface ReceiptSettingsForm {
  professional_name: string
  tax_code: string
  vat_number: string
  address: string
  albo_registration: string
  regime_note: string
  exempt_note: string
  bollo_threshold: number
  bollo_default_amount: number
}

const emptyForm: ReceiptSettingsForm = {
  professional_name: '',
  tax_code: '',
  vat_number: '',
  address: '',
  albo_registration: '',
  regime_note: DEFAULT_REGIME_NOTE,
  exempt_note: DEFAULT_EXEMPT_NOTE,
  bollo_threshold: 77.47,
  bollo_default_amount: 2,
}

/**
 * Self-contained settings card for "ricevute sanitarie": professional header
 * data + fiscal notes shown on every printed receipt, and the marca da
 * bollo threshold/amount. Meant to be mounted directly inside SettingsPage.
 */
export default function ReceiptSettings() {
  const { toast } = useToast()
  const { data: settings } = useReceiptSettings()
  const { mutateAsync: saveSettings, isPending } = useUpdateReceiptSettings()

  const [form, setForm] = useState<ReceiptSettingsForm>(emptyForm)

  useEffect(() => {
    if (settings) {
      setForm({
        professional_name: settings.professional_name || '',
        tax_code: settings.tax_code || '',
        vat_number: settings.vat_number || '',
        address: settings.address || '',
        albo_registration: settings.albo_registration || '',
        regime_note: settings.regime_note || DEFAULT_REGIME_NOTE,
        exempt_note: settings.exempt_note || DEFAULT_EXEMPT_NOTE,
        bollo_threshold: settings.bollo_threshold ?? 77.47,
        bollo_default_amount: settings.bollo_default_amount ?? 2,
      })
    }
  }, [settings])

  const handleSave = async () => {
    try {
      await saveSettings({
        professional_name: form.professional_name,
        tax_code: form.tax_code || null,
        vat_number: form.vat_number || null,
        address: form.address || null,
        albo_registration: form.albo_registration || null,
        regime_note: form.regime_note,
        exempt_note: form.exempt_note,
        bollo_threshold: form.bollo_threshold,
        bollo_default_amount: form.bollo_default_amount,
      })
      toast.success('Dati ricevute salvati')
    } catch (error) {
      toast.error('Errore nel salvataggio', {
        description: error instanceof Error ? error.message : 'Riprova',
      })
    }
  }

  return (
    <Card>
      <div className="flex items-center gap-2 mb-2">
        <Receipt className="w-4 h-4 text-muted-foreground" strokeWidth={1.85} />
        <h2 className="font-display text-xl font-semibold tracking-tight">Ricevute sanitarie</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
        Questi dati compaiono automaticamente su ogni ricevuta stampata: intestazione
        professionale, note fiscali e soglia della marca da bollo.
      </p>

      <div className="space-y-4">
        <Input
          label="Nome e cognome / studio *"
          value={form.professional_name}
          onChange={(e) => setForm({ ...form, professional_name: e.target.value })}
          placeholder="Dr.ssa Maria Rossi"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Codice fiscale"
            value={form.tax_code}
            onChange={(e) => setForm({ ...form, tax_code: e.target.value })}
          />
          <Input
            label="Partita IVA"
            value={form.vat_number}
            onChange={(e) => setForm({ ...form, vat_number: e.target.value })}
          />
        </div>

        <Input
          label="Indirizzo studio"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />

        <Input
          label="Iscrizione Albo"
          value={form.albo_registration}
          onChange={(e) => setForm({ ...form, albo_registration: e.target.value })}
          placeholder="Iscritto all'Albo degli Psicologi della Regione ... n. ..."
        />

        <Textarea
          label="Nota esenzione IVA"
          value={form.exempt_note}
          onChange={(e) => setForm({ ...form, exempt_note: e.target.value })}
        />

        <Textarea
          label="Nota regime fiscale"
          value={form.regime_note}
          onChange={(e) => setForm({ ...form, regime_note: e.target.value })}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Soglia marca da bollo (€)"
            type="number"
            step="0.01"
            min={0}
            value={form.bollo_threshold}
            onChange={(e) => setForm({ ...form, bollo_threshold: Number(e.target.value) })}
            hint="Oltre questo importo la marca viene proposta automaticamente."
          />
          <Input
            label="Importo marca da bollo (€)"
            type="number"
            step="0.01"
            min={0}
            value={form.bollo_default_amount}
            onChange={(e) => setForm({ ...form, bollo_default_amount: Number(e.target.value) })}
          />
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} loading={isPending} disabled={isPending}>
            <Save className="w-4 h-4" strokeWidth={2} />
            Salva dati ricevute
          </Button>
        </div>
      </div>
    </Card>
  )
}
