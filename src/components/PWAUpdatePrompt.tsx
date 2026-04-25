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
    <div className="fixed bottom-4 right-4 z-50 bg-card border border-border rounded-lg shadow-xl p-4 max-w-sm animate-in slide-in-from-bottom">
      <div className="flex items-start gap-3">
        <div className="bg-primary/10 text-primary p-2 rounded-lg flex-shrink-0">
          <RefreshCw className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-foreground mb-1">
            Aggiornamento disponibile
          </p>
          <p className="text-sm text-muted-foreground mb-3">
            Una nuova versione di PsyManager è disponibile.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => updateSW?.(true)}>
              Aggiorna
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setNeedRefresh(false)}
            >
              Più tardi
            </Button>
          </div>
        </div>
        <button
          onClick={() => setNeedRefresh(false)}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
