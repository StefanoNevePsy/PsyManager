import { useEffect, useState } from 'react'
import { Save, Calendar, Shield, User, AlertCircle, Check, Cloud, Bell } from 'lucide-react'
import { useGoogleCalendarStore } from '@/stores/googleCalendarStore'
import { useAuth } from '@/hooks/useAuth'
import { useUserProfile } from '@/hooks/useUserProfile'
import {
  useReminderSettings,
  useUpsertReminderSettings,
  DEFAULT_REMINDER_SETTINGS,
} from '@/hooks/useReminderSettings'
import { ensureNotificationPermission } from '@/lib/reminders'
import { Button, Card, Input, Select, PageHeader, useToast } from '@/components/ui'

export default function SettingsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const { profile, updateProfileAsync, isUpdating } = useUserProfile()
  const {
    initialize,
    connect,
    disconnect,
    isConnected,
    loading,
    error,
    initialized,
  } = useGoogleCalendarStore()
  const [profileData, setProfileData] = useState({
    fullName: '',
    email: user?.email || '',
  })

  const { data: reminderSettings } = useReminderSettings()
  const { mutateAsync: saveReminderSettings, isPending: isSavingReminders } =
    useUpsertReminderSettings()
  const [reminderForm, setReminderForm] = useState({
    pre_session_enabled: DEFAULT_REMINDER_SETTINGS.pre_session_enabled,
    pre_session_minutes: DEFAULT_REMINDER_SETTINGS.pre_session_minutes,
    post_session_enabled: DEFAULT_REMINDER_SETTINGS.post_session_enabled,
    post_session_minutes: DEFAULT_REMINDER_SETTINGS.post_session_minutes,
  })

  useEffect(() => {
    if (reminderSettings) {
      setReminderForm({
        pre_session_enabled: reminderSettings.pre_session_enabled,
        pre_session_minutes: reminderSettings.pre_session_minutes,
        post_session_enabled: reminderSettings.post_session_enabled,
        post_session_minutes: reminderSettings.post_session_minutes,
      })
    }
  }, [reminderSettings])

  const handleSaveReminders = async () => {
    try {
      // Ask for notification permission if any reminder is enabled
      if (reminderForm.pre_session_enabled || reminderForm.post_session_enabled) {
        const granted = await ensureNotificationPermission()
        if (!granted && /Android/i.test(navigator.userAgent)) {
          toast.warning('Permesso notifiche negato', {
            description: 'Abilita le notifiche nelle impostazioni di sistema per ricevere i promemoria.',
          })
        }
      }
      await saveReminderSettings(reminderForm)
      toast.success('Promemoria salvati')
    } catch (error) {
      toast.error('Errore nel salvataggio', {
        description: error instanceof Error ? error.message : 'Riprova',
      })
    }
  }

  useEffect(() => {
    if (profile) {
      setProfileData({
        fullName: profile.full_name || '',
        email: profile.email || '',
      })
    }
  }, [profile])

  useEffect(() => {
    if (!initialized) initialize()
  }, [initialized, initialize])

  const handleSaveProfile = async () => {
    try {
      await updateProfileAsync({ full_name: profileData.fullName })
      toast.success('Profilo salvato con successo')
    } catch (error) {
      toast.error('Errore nel salvataggio del profilo', {
        description: error instanceof Error ? error.message : 'Riprova più tardi',
      })
    }
  }

  const handleConnect = async () => {
    await connect()
    if (isConnected()) {
      toast.success('Google Calendar collegato')
    }
  }

  const handleDisconnect = () => {
    disconnect()
    toast.info('Google Calendar disconnesso')
  }

  const showOnboarding = () => {
    localStorage.removeItem('psymanager:onboarding-dismissed')
    window.location.reload()
  }

  return (
    <div className="px-4 md:px-10 py-8 md:py-12 space-y-8 max-w-3xl mx-auto">
      <PageHeader
        eyebrow="Configurazione"
        title="Impostazioni"
        description="Profilo, integrazioni e sicurezza del tuo account."
      />

      {/* Profile */}
      <Card>
        <div className="flex items-center gap-2 mb-5">
          <User className="w-4 h-4 text-muted-foreground" strokeWidth={1.85} />
          <h2 className="font-display text-xl font-semibold tracking-tight">Profilo</h2>
        </div>

        <div className="space-y-4">
          <Input label="Email" type="email" value={profileData.email} disabled />

          <Input
            label="Nome completo"
            type="text"
            value={profileData.fullName}
            onChange={(e) => setProfileData({ ...profileData, fullName: e.target.value })}
            placeholder="Dr. Mario Rossi"
            hint="Mostrato nella sezione utente."
          />

          <div className="flex justify-end pt-2">
            <Button onClick={handleSaveProfile} loading={isUpdating} disabled={isUpdating}>
              <Save className="w-4 h-4" strokeWidth={2} />
              Salva profilo
            </Button>
          </div>
        </div>
      </Card>

      {/* Google Calendar */}
      <Card>
        <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" strokeWidth={1.85} />
            <h2 className="font-display text-xl font-semibold tracking-tight">
              Google Calendar
            </h2>
          </div>
          {isConnected() && (
            <span className="inline-flex items-center gap-1.5 text-2xs uppercase tracking-wider font-semibold px-2 py-1 rounded-md bg-success-soft text-success">
              <Check className="w-3 h-3" strokeWidth={2.5} />
              Collegato
            </span>
          )}
        </div>

        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
          Sincronizza automaticamente le tue sedute con Google Calendar. Le modifiche fatte in
          PsyManager si rifletteranno sul Calendar.
        </p>

        {!import.meta.env.VITE_GOOGLE_CLIENT_ID && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-warning-soft border border-warning/20 text-warning mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={2.25} />
            <p className="text-sm leading-snug">
              Google Client ID non configurato. Aggiungi{' '}
              <code className="px-1.5 py-0.5 rounded bg-warning/10 text-2xs">VITE_GOOGLE_CLIENT_ID</code>{' '}
              ai secrets del repository per abilitare l'integrazione.
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive-soft border border-destructive/20 text-destructive mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={2.25} />
            <p className="text-sm leading-snug">{error}</p>
          </div>
        )}

        <div className="flex items-center gap-2">
          {isConnected() ? (
            <Button variant="outline" onClick={handleDisconnect}>
              Disconnetti
            </Button>
          ) : (
            <Button
              onClick={handleConnect}
              loading={loading}
              disabled={!import.meta.env.VITE_GOOGLE_CLIENT_ID}
            >
              <Cloud className="w-4 h-4" strokeWidth={2} />
              Collega Google Calendar
            </Button>
          )}
        </div>
      </Card>

      {/* Reminders */}
      <Card>
        <div className="flex items-center gap-2 mb-5">
          <Bell className="w-4 h-4 text-muted-foreground" strokeWidth={1.85} />
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Promemoria
          </h2>
        </div>

        <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
          Ricevi notifiche locali sul telefono prima delle sedute e per
          ricordare di registrare il pagamento. Funziona anche con l'app
          chiusa (solo Android).
        </p>

        <div className="space-y-5">
          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={reminderForm.pre_session_enabled}
                onChange={(e) =>
                  setReminderForm({
                    ...reminderForm,
                    pre_session_enabled: e.target.checked,
                  })
                }
                className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <div className="flex-1">
                <p className="font-medium text-sm">Promemoria prima della seduta</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Notifica per prepararti alla seduta in arrivo.
                </p>
              </div>
            </label>
            {reminderForm.pre_session_enabled && (
              <div className="ml-7">
                <Select
                  label="Quanto tempo prima"
                  value={String(reminderForm.pre_session_minutes)}
                  onChange={(e) =>
                    setReminderForm({
                      ...reminderForm,
                      pre_session_minutes: Number(e.target.value),
                    })
                  }
                  options={[
                    { value: '5', label: '5 minuti prima' },
                    { value: '15', label: '15 minuti prima' },
                    { value: '30', label: '30 minuti prima' },
                    { value: '60', label: '1 ora prima' },
                    { value: '120', label: '2 ore prima' },
                    { value: '1440', label: '1 giorno prima' },
                  ]}
                />
              </div>
            )}
          </div>

          <div className="space-y-3 pt-3 border-t border-border">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={reminderForm.post_session_enabled}
                onChange={(e) =>
                  setReminderForm({
                    ...reminderForm,
                    post_session_enabled: e.target.checked,
                  })
                }
                className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <div className="flex-1">
                <p className="font-medium text-sm">Ricorda di inserire il pagamento</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Solo per le sedute private. Tap sulla notifica per aprire
                  direttamente il modale di pagamento.
                </p>
              </div>
            </label>
            {reminderForm.post_session_enabled && (
              <div className="ml-7">
                <Select
                  label="Quanto tempo dopo la fine"
                  value={String(reminderForm.post_session_minutes)}
                  onChange={(e) =>
                    setReminderForm({
                      ...reminderForm,
                      post_session_minutes: Number(e.target.value),
                    })
                  }
                  options={[
                    { value: '0', label: 'Subito alla fine' },
                    { value: '5', label: '5 minuti dopo' },
                    { value: '15', label: '15 minuti dopo' },
                    { value: '30', label: '30 minuti dopo' },
                    { value: '60', label: '1 ora dopo' },
                  ]}
                />
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSaveReminders}
              loading={isSavingReminders}
              disabled={isSavingReminders}
            >
              <Save className="w-4 h-4" strokeWidth={2} />
              Salva promemoria
            </Button>
          </div>
        </div>
      </Card>

      {/* Security */}
      <Card>
        <div className="flex items-center gap-2 mb-5">
          <Shield className="w-4 h-4 text-muted-foreground" strokeWidth={1.85} />
          <h2 className="font-display text-xl font-semibold tracking-tight">Sicurezza</h2>
        </div>

        <div className="divide-y divide-border">
          <div className="pb-5">
            <p className="font-medium text-foreground mb-1">Cambia password</p>
            <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
              Modifica la password del tuo account.
            </p>
            <Button variant="outline" size="sm">
              Cambia password
            </Button>
          </div>

          <div className="pt-5">
            <p className="font-medium text-foreground mb-1">Autenticazione a due fattori</p>
            <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
              Aggiungi un livello extra di sicurezza. In arrivo.
            </p>
            <Button variant="outline" size="sm" disabled>
              Configura 2FA
            </Button>
          </div>
        </div>
      </Card>

      {/* Helpers */}
      <Card variant="quiet">
        <h2 className="font-display text-xl font-semibold tracking-tight mb-2">
          Hai bisogno di aiuto?
        </h2>
        <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
          Rivedi la guida iniziale per impostare i fondamentali (paziente, prestazione, seduta).
        </p>
        <Button variant="outline" size="sm" onClick={showOnboarding}>
          Mostra guida iniziale
        </Button>
      </Card>

      {/* About */}
      <div className="pt-4 border-t border-border text-center">
        <p className="font-display text-lg tracking-tight font-medium">
          PsyManager <span className="text-muted-foreground tabular-nums">v1.0.0</span>
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Gestionale gratuito per psicologi e terapeuti.
        </p>
      </div>
    </div>
  )
}
