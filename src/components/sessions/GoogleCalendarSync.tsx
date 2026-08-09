import { useEffect, useState } from 'react'
import { Calendar, RefreshCw, CheckCircle, AlertCircle, Sparkles } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { it } from 'date-fns/locale'
import { useGoogleCalendarStore } from '@/stores/googleCalendarStore'
import { useGoogleCalendarSync } from '@/hooks/useGoogleCalendarSync'
import {
  useCalendarSettings,
  useUpdateCalendarSettings,
  DEFAULT_CALENDAR_SETTINGS,
} from '@/hooks/useCalendarSettings'
import { Button, Select, useToast } from '@/components/ui'
import { CalendarTitleFormat } from '@/types/database'

const TITLE_FORMAT_OPTIONS: { value: CalendarTitleFormat; label: string }[] = [
  { value: 'full', label: 'Nome completo (Rossi Mario)' },
  { value: 'first_initial', label: 'Nome e iniziale (Mario R.)' },
  { value: 'initials', label: 'Solo iniziali (M.R.)' },
]

export default function GoogleCalendarSync() {
  const {
    initialize,
    connect,
    disconnect,
    isConnected,
    loading,
    error: storeError,
    initialized,
  } = useGoogleCalendarStore()

  const {
    syncing,
    syncProgress,
    error: syncError,
    fullSync,
    repushAll,
    unmappedEvents,
    lastSyncAt,
  } = useGoogleCalendarSync()

  const { data: calendarSettings } = useCalendarSettings()
  const updateCalendarSettings = useUpdateCalendarSettings()
  const { toast } = useToast()
  const [showApplyPrompt, setShowApplyPrompt] = useState(false)

  const titleFormat = calendarSettings?.title_format ?? DEFAULT_CALENDAR_SETTINGS.title_format
  const colorByService =
    calendarSettings?.color_by_service ?? DEFAULT_CALENDAR_SETTINGS.color_by_service
  const includeNotes =
    calendarSettings?.include_notes ?? DEFAULT_CALENDAR_SETTINGS.include_notes

  useEffect(() => {
    if (!initialized) {
      initialize()
    }
  }, [initialized, initialize])

  const error = storeError || syncError

  const handleTitleFormatChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as CalendarTitleFormat
    updateCalendarSettings.mutate(
      { title_format: value },
      {
        onSuccess: () => {
          toast.success('Preferenze calendario salvate')
          setShowApplyPrompt(true)
        },
        onError: () => toast.error('Errore nel salvataggio delle preferenze'),
      }
    )
  }

  const handleColorToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked
    updateCalendarSettings.mutate(
      { color_by_service: checked },
      {
        onSuccess: () => {
          toast.success('Preferenze calendario salvate')
          setShowApplyPrompt(true)
        },
        onError: () => toast.error('Errore nel salvataggio delle preferenze'),
      }
    )
  }

  const handleNotesToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked
    updateCalendarSettings.mutate(
      { include_notes: checked },
      {
        onSuccess: () => {
          toast.success('Preferenze calendario salvate')
          setShowApplyPrompt(true)
        },
        onError: () => toast.error('Errore nel salvataggio delle preferenze'),
      }
    )
  }

  const handleApplyToExisting = async () => {
    const count = await repushAll()
    if (count > 0) {
      toast.success(`${count} eventi aggiornati su Google Calendar`)
    }
    setShowApplyPrompt(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
            isConnected()
              ? 'bg-green-500/10 text-green-600 dark:text-green-400'
              : 'bg-secondary text-muted-foreground'
          }`}
        >
          {isConnected() ? (
            <>
              <CheckCircle className="w-4 h-4" />
              <span>Connesso</span>
            </>
          ) : (
            <>
              <Calendar className="w-4 h-4" />
              <span>Non connesso</span>
            </>
          )}
        </div>

        {isConnected() ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fullSync()}
              loading={syncing}
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              Sincronizza Ora
            </Button>
            <Button variant="ghost" size="sm" onClick={disconnect}>
              Disconnetti
            </Button>
            {lastSyncAt && (
              <span className="text-xs text-muted-foreground">
                Ultima sincronizzazione:{' '}
                {formatDistanceToNow(lastSyncAt, { addSuffix: true, locale: it })}
              </span>
            )}
          </>
        ) : (
          <Button size="sm" onClick={connect} loading={loading}>
            <Calendar className="w-4 h-4" />
            Connetti Google Calendar
          </Button>
        )}
      </div>

      {isConnected() && (
        <div className="bg-secondary/50 p-3 rounded-lg space-y-3">
          <div className="max-w-xs">
            <Select
              label="Nomi sul calendario"
              value={titleFormat}
              onChange={handleTitleFormatChange}
              disabled={syncing}
              options={TITLE_FORMAT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              I nomi abbreviati proteggono i dati dei pazienti sul tuo calendario Google.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={colorByService}
              onChange={handleColorToggle}
              disabled={syncing}
              className="w-4 h-4 rounded border-border text-primary focus:ring-ring focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            Colora gli eventi per tipo di prestazione
          </label>

          <div>
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeNotes}
                onChange={handleNotesToggle}
                disabled={syncing}
                className="w-4 h-4 rounded border-border text-primary focus:ring-ring focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              Includi le note della seduta nell'evento
            </label>
            <p className="text-xs text-muted-foreground mt-1 ml-6">
              Sconsigliato: le note possono contenere informazioni cliniche che
              verrebbero salvate sui server di Google.
            </p>
          </div>

          {showApplyPrompt && (
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <span className="text-xs text-muted-foreground">
                Applica le nuove preferenze anche alle sedute già presenti sul calendario.
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleApplyToExisting}
                loading={syncing}
                disabled={syncing}
              >
                <Sparkles className="w-4 h-4" />
                Applica agli eventi esistenti
              </Button>
            </div>
          )}
        </div>
      )}

      {syncing && syncProgress && syncProgress.total > 0 && (
        <div className="bg-secondary/50 p-3 rounded-lg text-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-muted-foreground">
              Sincronizzazione in corso...
            </span>
            <span className="tabular-nums font-medium">
              {syncProgress.current} / {syncProgress.total}
            </span>
          </div>
          <div className="h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{
                width: `${syncProgress.total > 0 ? (syncProgress.current / syncProgress.total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 bg-destructive/10 text-destructive p-3 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {unmappedEvents.length > 0 && (
        <div className="bg-orange-500/10 text-orange-600 dark:text-orange-400 p-3 rounded-lg text-sm">
          <p className="font-medium mb-1">
            {unmappedEvents.length} eventi nel calendario non associati
          </p>
          <p className="text-xs opacity-80">
            Hai eventi nel tuo Google Calendar che potrebbero essere sedute.
            Importali manualmente come sedute per associarli ai pazienti.
          </p>
        </div>
      )}
    </div>
  )
}
