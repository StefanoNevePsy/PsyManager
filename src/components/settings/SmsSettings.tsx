import { useEffect, useMemo, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { AlertTriangle, Lock, Save, Smartphone } from 'lucide-react'
import {
  useReminderSettings,
  useUpsertReminderSettings,
} from '@/hooks/useReminderSettings'
import { TEMPLATE_VARIABLES, renderTemplate } from '@/lib/whatsapp'
import { SessionWithRelations } from '@/hooks/useSessions'
import { SmsProvider, SmsRule } from '@/types/database'
import { Button, Card, Input, Select, Textarea, useToast } from '@/components/ui'

// ---------------------------------------------------------------------------
// Defaults — mirror the column defaults in migrations/014_sms_reminders.sql.
// Not shared via useReminderSettings' DEFAULT_REMINDER_SETTINGS because the
// SMS columns aren't part of that constant.
// ---------------------------------------------------------------------------
const DEFAULT_SMS_TEMPLATE = "Le ricordo l'appuntamento di {giorno} alle {ora}."

const DEFAULT_SMS_SETTINGS = {
  sms_enabled: false,
  sms_provider: 'skebby' as SmsProvider,
  sms_sender: '',
  sms_advance_minutes: 1440,
  sms_template: DEFAULT_SMS_TEMPLATE,
  sms_quiet_start: 21,
  sms_quiet_end: 8,
  sms_rule: 'all' as SmsRule,
}

const SENDER_MAX_LENGTH = 11

const PROVIDER_OPTIONS: { value: SmsProvider; label: string }[] = [
  { value: 'skebby', label: 'Skebby' },
  { value: 'twilio', label: 'Twilio' },
  { value: 'generic', label: 'Altro provider' },
]

const ADVANCE_MINUTES_OPTIONS = [
  { value: '60', label: '1 ora prima' },
  { value: '180', label: '3 ore prima' },
  { value: '720', label: '12 ore prima' },
  { value: '1440', label: 'Il giorno prima' },
  { value: '2880', label: '2 giorni prima' },
]

const RULE_OPTIONS: { value: SmsRule; label: string }[] = [
  { value: 'all', label: 'Tutte le sedute' },
  { value: 'first', label: 'Solo la prima seduta di ogni paziente' },
  { value: 'no_show', label: 'Solo pazienti con assenze passate' },
  { value: 'manual', label: 'Nessuna, solo manuale' },
]

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => ({
  value: String(h),
  label: `${String(h).padStart(2, '0')}:00`,
}))

// ---------------------------------------------------------------------------
// SMS length/cost meter
//
// GSM 03.38 default alphabet: characters in the basic set cost one septet,
// characters in the extension table (escape sequence) cost two. Any
// character outside both sets forces UCS-2 encoding for the whole message,
// which uses UTF-16 code units and has a much lower per-segment budget.
//
// Segment limits:
//   GSM-7  single: 160 septets   concatenated: 153 septets/segment
//   UCS-2  single: 70  units     concatenated: 67  units/segment
// (The concatenated limits are lower because each part reserves a few
// septets/units for the User Data Header that stitches multipart SMS back
// together.)
// ---------------------------------------------------------------------------
const GSM7_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡' +
  'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'

// Extension characters — each costs an escape septet plus the character
// septet (2 total).
const GSM7_EXTENDED = '^{}\\[~]|€\f'

const GSM7_BASIC_SET = new Set(GSM7_BASIC)
const GSM7_EXTENDED_SET = new Set(GSM7_EXTENDED)

interface SmsMeter {
  encoding: 'GSM-7' | 'UCS-2'
  length: number
  segments: number
}

/** Encoding-aware length/segment count for an SMS body. */
const measureSms = (text: string): SmsMeter => {
  if (!text) return { encoding: 'GSM-7', length: 0, segments: 0 }

  let isGsm7 = true
  let septets = 0
  for (const ch of text) {
    if (GSM7_BASIC_SET.has(ch)) {
      septets += 1
    } else if (GSM7_EXTENDED_SET.has(ch)) {
      septets += 2
    } else {
      isGsm7 = false
      break
    }
  }

  const length = text.length

  if (isGsm7) {
    const segments = septets <= 160 ? 1 : Math.ceil(septets / 153)
    return { encoding: 'GSM-7', length, segments }
  }

  const segments = length <= 70 ? 1 : Math.ceil(length / 67)
  return { encoding: 'UCS-2', length, segments }
}

/**
 * Self-contained settings section for automatic SMS reminders. Unlike
 * WhatsApp reminders (sent manually by tapping a pre-filled chat), SMS is
 * sent server-side on a schedule by an Edge Function — this panel only
 * edits the non-secret preferences the function reads; the provider API key
 * is configured separately as an Edge Function secret and never touches
 * the client.
 */
export default function SmsSettings() {
  const { toast } = useToast()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { data: settings } = useReminderSettings()
  const { mutateAsync: saveSettings, isPending: isSaving } = useUpsertReminderSettings()

  const [enabled, setEnabled] = useState(DEFAULT_SMS_SETTINGS.sms_enabled)
  const [provider, setProvider] = useState<SmsProvider>(DEFAULT_SMS_SETTINGS.sms_provider)
  const [sender, setSender] = useState(DEFAULT_SMS_SETTINGS.sms_sender)
  const [advanceMinutes, setAdvanceMinutes] = useState(
    DEFAULT_SMS_SETTINGS.sms_advance_minutes
  )
  const [rule, setRule] = useState<SmsRule>(DEFAULT_SMS_SETTINGS.sms_rule)
  const [quietStart, setQuietStart] = useState(DEFAULT_SMS_SETTINGS.sms_quiet_start)
  const [quietEnd, setQuietEnd] = useState(DEFAULT_SMS_SETTINGS.sms_quiet_end)
  const [template, setTemplate] = useState(DEFAULT_SMS_SETTINGS.sms_template)

  useEffect(() => {
    if (settings) {
      setEnabled(settings.sms_enabled)
      setProvider(settings.sms_provider)
      setSender(settings.sms_sender || '')
      setAdvanceMinutes(settings.sms_advance_minutes)
      setRule(settings.sms_rule)
      setQuietStart(settings.sms_quiet_start)
      setQuietEnd(settings.sms_quiet_end)
      setTemplate(settings.sms_template || DEFAULT_SMS_TEMPLATE)
    }
  }, [settings])

  // Fake session used only to render a live preview of the template — never
  // sent anywhere.
  const previewSession = useMemo(() => {
    const at = new Date()
    at.setDate(at.getDate() + 1)
    at.setHours(15, 30, 0, 0)
    return {
      scheduled_at: at.toISOString(),
      duration_minutes: 60,
      group_id: null,
      patients: { first_name: 'Mario', last_name: 'Rossi' },
      patient_groups: null,
      service_types: { name: 'Psicoterapia individuale' },
    } as unknown as SessionWithRelations
  }, [])

  const preview = useMemo(
    () => renderTemplate(template || DEFAULT_SMS_TEMPLATE, previewSession),
    [template, previewSession]
  )

  const meter = useMemo(() => measureSms(preview), [preview])

  /** Insert a placeholder at the textarea's current caret position. */
  const insertVariable = (key: string) => {
    const el = textareaRef.current
    if (!el) {
      setTemplate((t) => t + key)
      return
    }
    const start = el.selectionStart ?? template.length
    const end = el.selectionEnd ?? template.length
    const next = template.slice(0, start) + key + template.slice(end)
    setTemplate(next)
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + key.length
      el.setSelectionRange(pos, pos)
    })
  }

  const handleSave = async () => {
    try {
      await saveSettings({
        sms_enabled: enabled,
        sms_provider: provider,
        sms_sender: sender.trim().slice(0, SENDER_MAX_LENGTH),
        sms_advance_minutes: advanceMinutes,
        sms_rule: rule,
        sms_quiet_start: quietStart,
        sms_quiet_end: quietEnd,
        sms_template: template.trim() || DEFAULT_SMS_TEMPLATE,
      })
      toast.success('Impostazioni SMS salvate')
    } catch (error) {
      toast.error('Errore nel salvataggio', {
        description: error instanceof Error ? error.message : 'Riprova',
      })
    }
  }

  return (
    <Card>
      <div className="flex items-center gap-2 mb-5">
        <Smartphone className="w-4 h-4 text-muted-foreground" strokeWidth={1.85} />
        <h2 className="font-display text-xl font-semibold tracking-tight">
          Promemoria SMS automatici
        </h2>
      </div>

      <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
        A differenza dei promemoria WhatsApp, gli SMS vengono inviati
        automaticamente da un servizio in background, secondo la
        pianificazione scelta qui sotto — anche ad app chiusa.
      </p>

      <label className="flex items-start gap-3 cursor-pointer mb-5">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-primary"
        />
        <div className="flex-1">
          <p className="font-medium text-sm">Promemoria SMS automatici ai pazienti</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Invia un SMS prima di ogni seduta, senza intervento manuale.
          </p>
        </div>
      </label>

      {!enabled && (
        <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/40 p-3.5 mb-5">
          <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" strokeWidth={1.85} />
          <p className="text-xs text-muted-foreground leading-relaxed">
            L'invio automatico richiede un account presso un provider SMS
            (es. Skebby o Twilio) e una funzione server (Edge Function) già
            configurata con la relativa chiave API — la chiave non viene mai
            salvata o gestita da questa app. Consulta{' '}
            <span className="font-medium text-foreground">docs/SMS_REMINDERS.md</span>{' '}
            per la procedura completa.
          </p>
        </div>
      )}

      <div
        className={clsx(
          'space-y-5 transition-opacity duration-150',
          !enabled && 'opacity-50 pointer-events-none'
        )}
        aria-disabled={!enabled}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Provider"
            hint="L'adattatore usato dalla funzione server per l'invio"
            value={provider}
            onChange={(e) => setProvider(e.target.value as SmsProvider)}
            options={PROVIDER_OPTIONS}
            disabled={!enabled}
          />
          <Input
            label="Mittente"
            value={sender}
            onChange={(e) => setSender(e.target.value.slice(0, SENDER_MAX_LENGTH))}
            maxLength={SENDER_MAX_LENGTH}
            placeholder="es. StudioRossi"
            hint={`Deve essere registrato presso il provider · ${sender.length}/${SENDER_MAX_LENGTH} caratteri`}
            disabled={!enabled}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Invia con anticipo"
            value={String(advanceMinutes)}
            onChange={(e) => setAdvanceMinutes(Number(e.target.value))}
            options={ADVANCE_MINUTES_OPTIONS}
            disabled={!enabled}
          />
          <Select
            label="Sedute da avvisare"
            value={rule}
            onChange={(e) => setRule(e.target.value as SmsRule)}
            options={RULE_OPTIONS}
            disabled={!enabled}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Non inviare dalle"
            value={String(quietStart)}
            onChange={(e) => setQuietStart(Number(e.target.value))}
            options={HOUR_OPTIONS}
            disabled={!enabled}
          />
          <Select
            label="alle"
            value={String(quietEnd)}
            onChange={(e) => setQuietEnd(Number(e.target.value))}
            options={HOUR_OPTIONS}
            hint="Fascia oraria di silenzio: gli SMS pianificati in questo intervallo vengono rimandati"
            disabled={!enabled}
          />
        </div>

        <div className="space-y-2">
          <Textarea
            ref={textareaRef}
            label="Messaggio"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            rows={4}
            disabled={!enabled}
          />
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATE_VARIABLES.map((v) => (
              <button
                key={v.key}
                type="button"
                title={v.hint}
                onClick={() => insertVariable(v.key)}
                disabled={!enabled}
                className="px-2.5 py-1 text-xs font-medium rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/70 transition-colors disabled:opacity-50"
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Anteprima
          </p>
          <p className="text-sm text-foreground/90 bg-muted/40 border border-border/40 rounded-lg p-3 whitespace-pre-wrap">
            {preview}
          </p>

          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-muted-foreground">
              {meter.length} caratteri · {meter.segments} SMS
              <span className="ml-1">({meter.encoding})</span>
            </span>
          </div>
          {meter.segments > 1 && (
            <div className="flex items-start gap-1.5 text-xs text-warning">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" strokeWidth={2} />
              <span>
                Il messaggio supera il limite di un singolo SMS e verrà
                inviato come {meter.segments} messaggi separati, con costo
                proporzionale presso il provider.
              </span>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/60 pt-4">
          Il testo dell'SMS può comparire nella schermata di blocco del
          telefono del paziente: evita riferimenti clinici o diagnostici,
          limitati a data e ora dell'appuntamento.
        </p>
      </div>

      <div className="flex justify-end pt-5">
        <Button onClick={handleSave} loading={isSaving} disabled={isSaving}>
          <Save className="w-4 h-4" strokeWidth={2} />
          Salva
        </Button>
      </div>
    </Card>
  )
}
