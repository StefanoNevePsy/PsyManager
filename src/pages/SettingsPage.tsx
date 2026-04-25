import { Save } from 'lucide-react'
import { useState } from 'react'

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    googleCalendarConnected: false,
    twoFactorEnabled: false,
  })

  const handleSave = () => {
    // TODO: Save settings
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Impostazioni</h1>
        <p className="text-muted-foreground">
          Configura i tuoi parametri e le integrazioni
        </p>
      </div>

      <div className="space-y-6">
        {/* Google Calendar */}
        <div className="bg-card rounded-lg border border-border p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Integrazione Google Calendar
          </h2>
          <p className="text-muted-foreground mb-4">
            Sincronizza le tue sedute con Google Calendar
          </p>
          <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90">
            {settings.googleCalendarConnected ? 'Disconnetti' : 'Connetti'}
          </button>
        </div>

        {/* Profile Settings */}
        <div className="bg-card rounded-lg border border-border p-6 space-y-4">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Profilo
          </h2>

          <div>
            <label className="block text-sm font-medium text-card-foreground mb-2">
              Email
            </label>
            <input
              type="email"
              className="w-full px-4 py-2 bg-input border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-card-foreground mb-2">
              Nome Completo
            </label>
            <input
              type="text"
              className="w-full px-4 py-2 bg-input border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Nome Cognome"
            />
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-card rounded-lg border border-border p-6 space-y-4">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Sicurezza
          </h2>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-card-foreground">
                Autenticazione a Due Fattori
              </p>
              <p className="text-sm text-muted-foreground">
                Aumenta la sicurezza del tuo account
              </p>
            </div>
            <button
              onClick={() =>
                setSettings({
                  ...settings,
                  twoFactorEnabled: !settings.twoFactorEnabled,
                })
              }
              className={`px-4 py-2 rounded-lg transition-colors ${
                settings.twoFactorEnabled
                  ? 'bg-green-500/20 text-green-600'
                  : 'bg-secondary text-foreground hover:bg-secondary/80'
              }`}
            >
              {settings.twoFactorEnabled ? 'Abilitata' : 'Disabilitata'}
            </button>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            className="bg-primary text-primary-foreground px-6 py-2 rounded-lg hover:opacity-90 flex items-center gap-2"
          >
            <Save className="w-5 h-5" />
            Salva Impostazioni
          </button>
        </div>
      </div>
    </div>
  )
}
