import { useEffect, useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui'

export default function PWAUpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [updateSW, setUpdateSW] = useState<((reload?: boolean) => Promise<void>) | null>(
    null
  )

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      import('virtual:pwa-register')
        .then(({ registerSW }) => {
          const update = registerSW({
            onNeedRefresh() {
              setNeedRefresh(true)
            },
            onOfflineReady() {
              console.log('App ready to work offline')
            },
          })
          setUpdateSW(() => update)
        })
        .catch(() => {
          // PWA not available in dev mode
        })
    }
  }, [])

  if (!needRefresh) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-[100] sm:max-w-sm bg-card border border-border rounded-lg shadow-pop p-4 animate-slide-in-from-bottom">
      <div className="flex items-start gap-3">
        <div className="bg-primary-soft text-primary p-2 rounded-md flex-shrink-0">
          <RefreshCw className="w-4 h-4" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-semibold text-foreground mb-0.5 text-base tracking-tight">
            Aggiornamento disponibile
          </p>
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
            Una nuova versione di PsyManager è pronta da installare.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => updateSW?.(true)}>
              Aggiorna ora
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setNeedRefresh(false)}>
              Più tardi
            </Button>
          </div>
        </div>
        <button
          onClick={() => setNeedRefresh(false)}
          className="text-muted-foreground hover:text-foreground p-1 -m-1 rounded transition-colors"
          aria-label="Chiudi notifica aggiornamento"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
