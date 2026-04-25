import { useEffect } from 'react'
import { Calendar, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'
import { useGoogleCalendarStore } from '@/stores/googleCalendarStore'
import { useGoogleCalendarSync } from '@/hooks/useGoogleCalendarSync'
import { Button } from '@/components/ui'

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

  const { syncing, error: syncError, fullSync, unmappedEvents } = useGoogleCalendarSync()

  useEffect(() => {
    if (!initialized) {
      initialize()
    }
  }, [initialized, initialize])

  const error = storeError || syncError

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
          </>
        ) : (
          <Button size="sm" onClick={connect} loading={loading}>
            <Calendar className="w-4 h-4" />
            Connetti Google Calendar
          </Button>
        )}
      </div>

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
