import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { CheckCircle2, Eye, EyeOff, KeyRound, Send, ShieldAlert } from 'lucide-react'
import { Button, Card, Input, Select, Textarea, useToast } from '@/components/ui'
import {
  useSaveSmsCredentials,
  useSendTestSms,
  useSmsCredentialsStatus,
} from '@/hooks/useSmsCredentials'
import {
  PLACEHOLDER_HELP,
  SMS_PROVIDER_PRESETS,
  SmsAuthType,
  SmsBodyFormat,
  getSmsProviderPreset,
} from '@/lib/smsProviders'

const AUTH_TYPE_OPTIONS: { value: SmsAuthType; label: string }[] = [
  { value: 'basic', label: 'Basic Auth (utente + password)' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'none', label: 'Nessuna autenticazione' },
]

const BODY_FORMAT_OPTIONS: { value: SmsBodyFormat; label: string }[] = [
  { value: 'json', label: 'JSON' },
  { value: 'form', label: 'Form (x-www-form-urlencoded)' },
]

const PROVIDER_SELECT_OPTIONS = SMS_PROVIDER_PRESETS.map((p) => ({
  value: p.id,
  label: p.label,
}))

/**
 * In-app configuration for the custom SMS provider used by
 * `send_test_sms` / the reminders Edge Function. Credentials are saved
 * write-only: `sms_credentials` has no SELECT policy, so this card only
 * ever reads back non-secret status from `sms_credentials_status`.
 */
export default function SmsCredentialsCard() {
  const { toast } = useToast()

  const { data: status, isLoading: isLoadingStatus } = useSmsCredentialsStatus()
  const { mutateAsync: saveCredentials, isPending: isSaving } = useSaveSmsCredentials()
  const { mutateAsync: sendTest, isPending: isSendingTest } = useSendTestSms()

  const [presetId, setPresetId] = useState('custom')
  const [endpointUrl, setEndpointUrl] = useState('')
  const [authType, setAuthType] = useState<SmsAuthType>('none')
  const [authUser, setAuthUser] = useState('')
  const [authSecret, setAuthSecret] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [bodyFormat, setBodyFormat] = useState<SmsBodyFormat>('json')
  const [bodyTemplate, setBodyTemplate] = useState('')

  const [testPhone, setTestPhone] = useState('')
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  const activePreset = useMemo(() => getSmsProviderPreset(presetId), [presetId])
  const credentialLabels = activePreset?.credentialLabels ?? { user: 'Utente / Chiave', secret: 'Password / Token' }

  const isConfigured = !!status?.configured

  // Prefill non-secret fields once the status/preset is known — secret
  // fields are intentionally never prefilled (the server can't return them).
  useEffect(() => {
    if (status?.body_format) setBodyFormat(status.body_format)
    if (status?.auth_type) setAuthType(status.auth_type)
  }, [status])

  const handlePresetChange = (id: string) => {
    setPresetId(id)
    const preset = getSmsProviderPreset(id)
    if (!preset) return
    setEndpointUrl(preset.endpoint_url)
    setAuthType(preset.auth_type)
    setBodyFormat(preset.body_format)
    setBodyTemplate(preset.body_template)
  }

  const handleSave = async () => {
    if (!endpointUrl.trim()) {
      toast.error('URL endpoint obbligatorio')
      return
    }
    if (!bodyTemplate.trim()) {
      toast.error('Template del corpo del messaggio obbligatorio')
      return
    }
    if (authType !== 'none' && !authSecret.trim() && !isConfigured) {
      toast.error('Credenziale segreta obbligatoria', {
        description: 'Necessaria al primo salvataggio; nei salvataggi successivi puoi lasciarla vuota per mantenere quella già salvata.',
      })
      return
    }

    try {
      await saveCredentials({
        endpoint_url: endpointUrl.trim(),
        auth_type: authType,
        auth_user: authUser.trim() || null,
        // Omit the key entirely when left blank so a re-save doesn't erase
        // the secret already stored server-side.
        ...(authSecret.trim() ? { auth_secret: authSecret.trim() } : {}),
        body_format: bodyFormat,
        body_template: bodyTemplate,
      })
      toast.success('Credenziali SMS salvate')
      setAuthSecret('')
      setShowSecret(false)
    } catch (error) {
      toast.error('Errore nel salvataggio', {
        description: error instanceof Error ? error.message : 'Riprova',
      })
    }
  }

  const handleTestSms = async () => {
    setTestResult(null)
    try {
      await sendTest(testPhone.trim())
      toast.success('SMS di prova inviato')
      setTestResult({ ok: true, message: 'Messaggio inviato correttamente.' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invio non riuscito'
      toast.error('Invio non riuscito', { description: message })
      setTestResult({ ok: false, message })
    }
  }

  return (
    <Card>
      <div className="flex items-center gap-2 mb-5">
        <KeyRound className="w-4 h-4 text-muted-foreground" strokeWidth={1.85} />
        <h2 className="font-display text-xl font-semibold tracking-tight">
          Credenziali provider SMS
        </h2>
      </div>

      {!isLoadingStatus && (
        <div
          className={
            isConfigured
              ? 'flex items-start gap-2.5 rounded-lg border border-success/30 bg-success-soft p-3.5 mb-5'
              : 'flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning-soft p-3.5 mb-5'
          }
        >
          {isConfigured ? (
            <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" strokeWidth={2} />
          ) : (
            <ShieldAlert className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" strokeWidth={2} />
          )}
          <div className="text-xs leading-relaxed">
            {isConfigured ? (
              <>
                <p className="font-medium text-foreground">Credenziali configurate</p>
                <p className="text-muted-foreground mt-0.5">
                  Endpoint: <span className="font-mono">{status?.endpoint_host}</span>
                  {status?.updated_at && (
                    <>
                      {' '}
                      · aggiornate il{' '}
                      {format(new Date(status.updated_at), "d MMM yyyy 'alle' HH:mm", { locale: it })}
                    </>
                  )}
                </p>
              </>
            ) : (
              <>
                <p className="font-medium text-foreground">Credenziali non configurate</p>
                <p className="text-muted-foreground mt-0.5">
                  Compila e salva i campi qui sotto per abilitare l'invio SMS.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/40 p-3.5 mb-5">
        <ShieldAlert className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" strokeWidth={1.85} />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Le credenziali vengono salvate lato server e{' '}
          <span className="font-medium text-foreground">l'app non può più rileggerle</span> una
          volta inviate. Per questo il campo della credenziale segreta parte sempre vuoto: se lo
          lasci vuoto e salvi di nuovo, il valore già salvato resta invariato.
        </p>
      </div>

      <div className="space-y-5">
        <Select
          label="Provider"
          hint="Precompila endpoint, autenticazione e template — resta tutto modificabile"
          value={presetId}
          onChange={(e) => handlePresetChange(e.target.value)}
          options={PROVIDER_SELECT_OPTIONS}
        />
        {activePreset?.docsHint && (
          <p className="text-xs text-muted-foreground -mt-3">{activePreset.docsHint}</p>
        )}

        <Input
          label="URL endpoint"
          value={endpointUrl}
          onChange={(e) => setEndpointUrl(e.target.value)}
          placeholder="https://api.provider.it/rest/sms/send"
          required
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Autenticazione"
            value={authType}
            onChange={(e) => setAuthType(e.target.value as SmsAuthType)}
            options={AUTH_TYPE_OPTIONS}
          />
          <Select
            label="Formato corpo"
            value={bodyFormat}
            onChange={(e) => setBodyFormat(e.target.value as SmsBodyFormat)}
            options={BODY_FORMAT_OPTIONS}
          />
        </div>

        {authType !== 'none' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {credentialLabels.user !== '—' && (
              <Input
                label={credentialLabels.user}
                value={authUser}
                onChange={(e) => setAuthUser(e.target.value)}
                autoComplete="off"
              />
            )}
            <Input
              label={credentialLabels.secret}
              type={showSecret ? 'text' : 'password'}
              value={authSecret}
              onChange={(e) => setAuthSecret(e.target.value)}
              autoComplete="off"
              placeholder={isConfigured ? '••••••••  (lascia vuoto per non modificare)' : ''}
              hint={isConfigured ? 'Vuoto = mantieni il valore già salvato' : undefined}
              rightSlot={
                <button
                  type="button"
                  onClick={() => setShowSecret((v) => !v)}
                  aria-label={showSecret ? 'Nascondi credenziale' : 'Mostra credenziale'}
                  className="p-0.5"
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />
          </div>
        )}

        <div className="space-y-2">
          <Textarea
            label="Template corpo richiesta"
            value={bodyTemplate}
            onChange={(e) => setBodyTemplate(e.target.value)}
            rows={3}
            className="font-mono text-xs"
            required
          />
          <div className="space-y-1">
            {PLACEHOLDER_HELP.map((p) => (
              <p key={p.placeholder} className="text-xs text-muted-foreground">
                <span className="font-mono font-medium text-foreground">{p.placeholder}</span>{' '}
                — {p.description}
              </p>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <Button onClick={handleSave} loading={isSaving} disabled={isSaving}>
            <KeyRound className="w-4 h-4" strokeWidth={2} />
            Salva credenziali
          </Button>
        </div>
      </div>

      <div className="border-t border-border/60 mt-6 pt-5 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Invia SMS di prova</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Invia un messaggio di test al numero indicato usando le credenziali salvate, per
          verificare che la configurazione sia corretta.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1">
            <Input
              label="Numero di telefono"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="393331234567"
              disabled={!isConfigured}
            />
          </div>
          <Button
            variant="secondary"
            onClick={handleTestSms}
            loading={isSendingTest}
            disabled={!isConfigured || isSendingTest || !testPhone.trim()}
          >
            <Send className="w-4 h-4" strokeWidth={2} />
            Invia SMS di prova
          </Button>
        </div>
        {!isConfigured && (
          <p className="text-xs text-muted-foreground">
            Salva prima le credenziali per poter inviare un messaggio di prova.
          </p>
        )}
        {testResult && (
          <p
            className={
              testResult.ok
                ? 'text-xs text-success font-medium'
                : 'text-xs text-destructive font-medium'
            }
          >
            {testResult.message}
          </p>
        )}
        <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/60 pt-3">
          Il nome mittente deve essere registrato presso il provider prima dell'uso — in Italia
          questa registrazione è obbligatoria per legge.
        </p>
      </div>
    </Card>
  )
}
