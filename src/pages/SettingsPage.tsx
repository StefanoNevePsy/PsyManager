import { useEffect, useState } from 'react'
import { Save, Calendar, Shield, User, AlertCircle, Check, Cloud } from 'lucide-react'
import { useGoogleCalendarStore } from '@/stores/googleCalendarStore'
import { useAuth } from '@/hooks/useAuth'
import { useUserProfile } from '@/hooks/useUserProfile'
import { Button, Card, Input, PageHeader, useToast } from '@/components/ui'

export default function SettingsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const { profile, updateProfile, isUpdating } = useUserProfile()
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
      await updateProfile({ full_name: profileData.fullName })
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
