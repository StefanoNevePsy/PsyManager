import { useEffect, useMemo, useRef, useState } from 'react'
import { MessageCircle, Save } from 'lucide-react'
import {
  useReminderSettings,
  useUpsertReminderSettings,
  DEFAULT_REMINDER_SETTINGS,
} from '@/hooks/useReminderSettings'
import { ensureNotificationPermission } from '@/lib/reminders'
import { DEFAULT_WHATSAPP_TEMPLATE, TEMPLATE_VARIABLES, renderTemplate } from '@/lib/whatsapp'
import { SessionWithRelations } from '@/hooks/useSessions'
import { Button, Card, Select, Textarea, useToast } from '@/components/ui'

const NOTIFY_MINUTES_OPTIONS = [
  { value: '60', label: '1 ora prima' },
  { value: '180', label: '3 ore prima' },
  { value: '720', label: '12 ore prima' },
  { value: '1440', label: 'Il giorno prima' },
  { value: '2880', label: '2 giorni prima' },
]

/**
 * Self-contained settings section for the WhatsApp reminder feature: enable
 * toggle, editable message template (with insertable placeholders and a live
 * preview), and when to be nudged to send the reminders.
 */
export default function WhatsAppSettings() {
  const { toast } = useToast()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { data: settings } = useReminderSettings()
  const { mutateAsync: saveSettings, isPending: isSaving } = useUpsertReminderSettings()

  const [enabled, setEnabled] = useState(DEFAULT_REMINDER_SETTINGS.whatsapp_enabled)
  const [template, setTemplate] = useState(DEFAULT_REMINDER_SETTINGS.whatsapp_template)
  const [notifyMinutes, setNotifyMinutes] = useState(
    DEFAULT_REMINDER_SETTINGS.whatsapp_notify_minutes
  )

  useEffect(() => {
    if (settings) {
      setEnabled(settings.whatsapp_enabled)
      setTemplate(settings.whatsapp_template || DEFAULT_WHATSAPP_TEMPLATE)
      setNotifyMinutes(settings.whatsapp_notify_minutes)
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
    () => renderTemplate(template || DEFAULT_WHATSAPP_TEMPLATE, previewSession),
    [template, previewSession]
  )

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
      if (enabled) {
        const granted = await ensureNotificationPermission()
        if (!granted && /Android/i.test(navigator.userAgent)) {
          toast.warning('Permesso notifiche negato', {
            description:
              'Abilita le notifiche nelle impostazioni di sistema per ricevere i promemoria.',
          })
        }
      }
      await saveSettings({
        whatsapp_enabled: enabled,
        whatsapp_template: template.trim() || DEFAULT_WHATSAPP_TEMPLATE,
        whatsapp_notify_minutes: notifyMinutes,
      })
      toast.success('Impostazioni WhatsApp salvate')
    } catch (error) {
      toast.error('Errore nel salvataggio', {
        description: error instanceof Error ? error.message : 'Riprova',
      })
    }
  }

  return (
    <Card>
      <div className="flex items-center gap-2 mb-5">
        <MessageCircle className="w-4 h-4 text-muted-foreground" strokeWidth={1.85} />
        <h2 className="font-display text-xl font-semibold tracking-tight">
          Promemoria WhatsApp
        </h2>
      </div>

      <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
        Prepara un messaggio da inviare su WhatsApp ai pazienti prima degli
        appuntamenti. L'invio resta manuale: l'app apre la chat già compilata,
        tu premi Invio.
      </p>

      <div className="space-y-5">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-primary"
          />
          <div className="flex-1">
            <p className="font-medium text-sm">Promemoria WhatsApp ai pazienti</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Abilita la pagina Promemoria e le notifiche che ti ricordano di
              inviarli.
            </p>
          </div>
        </label>

        <div className="space-y-2">
          <Textarea
            ref={textareaRef}
            label="Messaggio"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            rows={4}
          />
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATE_VARIABLES.map((v) => (
              <button
                key={v.key}
                type="button"
                title={v.hint}
                onClick={() => insertVariable(v.key)}
                className="px-2.5 py-1 text-xs font-medium rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/70 transition-colors"
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
        </div>

        <Select
          label="Ricordamelo"
          hint="Riceverai una notifica sul telefono per ricordarti di inviare i promemoria."
          value={String(notifyMinutes)}
          onChange={(e) => setNotifyMinutes(Number(e.target.value))}
          options={NOTIFY_MINUTES_OPTIONS}
        />

        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} loading={isSaving} disabled={isSaving}>
            <Save className="w-4 h-4" strokeWidth={2} />
            Salva
          </Button>
        </div>
      </div>
    </Card>
  )
}
