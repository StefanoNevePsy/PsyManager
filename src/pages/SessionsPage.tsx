import { Plus, Calendar } from 'lucide-react'
import { useState } from 'react'

export default function SessionsPage() {
  const [view, setView] = useState<'month' | 'week' | 'day'>('month')

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Sedute</h1>
          <p className="text-muted-foreground">
            Calendario e gestione delle tue sedute di terapia
          </p>
        </div>
        <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90 flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Nuova Seduta
        </button>
      </div>

      <div className="bg-card rounded-lg border border-border p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            {(['day', 'week', 'month'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-2 rounded-lg transition-colors capitalize ${
                  view === v
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-foreground hover:bg-secondary/80'
                }`}
              >
                {v === 'day' ? 'Giorno' : v === 'week' ? 'Settimana' : 'Mese'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-5 h-5" />
            <span>Sincronizzazione Google Calendar</span>
          </div>
        </div>

        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <div className="text-center">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Calendario non configurato</p>
            <p className="text-sm">Configura la sincronizzazione con Google Calendar</p>
          </div>
        </div>
      </div>
    </div>
  )
}
