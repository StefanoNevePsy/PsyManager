import { useEffect, useState } from 'react'
import { Save, Calendar, Shield, User } from 'lucide-react'
import { useGoogleCalendarStore } from '@/stores/googleCalendarStore'
import { useAuth } from '@/hooks/useAuth'
import { Button, Card, Input, PageHeader } from '@/components/ui'

export default function SettingsPage() {
  const { user } = useAuth()
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
    if (!initialized) {
      initialize()
    }
  }, [initialized, initialize])

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-3xl">
      <PageHeader
        title="Impostazioni"
        description="Configura il tuo profilo e le integrazioni"
      />

      {/* Profile Settings */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-xl font-semibold text-foreground">Profilo</h2>
        </div>

        <div className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={profileData.email}
            disabled
          />

          <Input
            label="Nome Completo"
            type="text"
            value={profileData.fullName}
            onChange={(e) =>
              setProfileData({ ...profileData, fullName: e.target.value })
            }
            placeholder="Dr. Mario Rossi"
          />

          <div className="flex justify-end">
            <Button>
              <Save className="w-4 h-4" />
              Salva Profilo
            </Button>
          </div>
        </div>
      </Card>

      {/* Google Calendar Integration */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-xl font-semibold text-foreground">
            Integrazione Google Calendar
          </h2>
        </div>

        <p className="text-muted-foreground mb-4 text-sm">
          Sincronizza automaticamente le tue sedute con Google Calendar. Le
          modifiche fatte in PsyManager si rifletteranno sul Calendar e viceversa.
        </p>

        {!import.meta.env.VITE_GOOGLE_CLIENT_ID && (
          <div className="bg-orange-500/10 text-orange-600 dark:text-orange-400 p-3 rounded-lg text-sm mb-4">
            ⚠️ Google Client ID non configurato. Configura{' '}
            <code className="bg-orange-500/20 px-1 rounded">
              VITE_GOOGLE_CLIENT_ID
            </code>{' '}
            nel file .env per abilitare l'integrazione.
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          {isConnected() ? (
            <>
              <span className="bg-green-500/10 text-green-600 dark:text-green-400 px-3 py-1.5 rounded-full text-sm font-medium">
                ✓ Connesso
              </span>
              <Button variant="outline" onClick={disconnect}>
                Disconnetti
              </Button>
            </>
          ) : (
            <Button
              onClick={connect}
              loading={loading}
              disabled={!import.meta.env.VITE_GOOGLE_CLIENT_ID}
            >
              <Calendar className="w-4 h-4" />
              Connetti Google Calendar
            </Button>
          )}
        </div>
      </Card>

      {/* Security Settings */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-xl font-semibold text-foreground">Sicurezza</h2>
        </div>

        <div className="space-y-4">
          <div>
            <p className="font-medium text-foreground mb-1">Cambia Password</p>
            <p className="text-sm text-muted-foreground mb-3">
              Modifica la password del tuo account
            </p>
            <Button variant="outline" size="sm">
              Cambia Password
            </Button>
          </div>

          <div className="border-t border-border pt-4">
            <p className="font-medium text-foreground mb-1">
              Autenticazione a Due Fattori
            </p>
            <p className="text-sm text-muted-foreground mb-3">
              Aggiungi un livello extra di sicurezza al tuo account (in arrivo)
            </p>
            <Button variant="outline" size="sm" disabled>
              Configura 2FA
            </Button>
          </div>
        </div>
      </Card>

      {/* About */}
      <Card>
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Informazioni
        </h2>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>PsyManager v1.0.0</p>
          <p>Gestionale gratuito per psicologi e terapeuti</p>
        </div>
      </Card>
    </div>
  )
}
