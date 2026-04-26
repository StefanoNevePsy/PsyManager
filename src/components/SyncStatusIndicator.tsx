import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Cloud, CloudOff } from 'lucide-react'
import { useGoogleCalendarStore } from '@/stores/googleCalendarStore'
import { Tooltip } from '@/components/ui'

export default function SyncStatusIndicator() {
  const { token, initialized, initialize } = useGoogleCalendarStore()

  useEffect(() => {
    if (!initialized) initialize()
  }, [initialized, initialize])

  const connected = !!token
  const Icon = connected ? Cloud : CloudOff
  const label = connected
    ? 'Google Calendar collegato'
    : 'Google Calendar non collegato'

  return (
    <Tooltip label={label} side="bottom">
      <Link
        to="/settings"
        aria-label={label}
        className="hidden sm:inline-flex items-center gap-1.5 h-9 px-2.5 rounded-md hover:bg-secondary/70 transition-colors text-muted-foreground hover:text-foreground"
      >
        <Icon
          className={`w-[18px] h-[18px] ${connected ? 'text-success' : 'text-muted-foreground'}`}
          strokeWidth={1.85}
        />
        <span className="hidden lg:inline text-sm font-medium">
          {connected ? 'Sincronizzato' : 'Offline'}
        </span>
        {connected && (
          <span
            aria-hidden="true"
            className="hidden lg:inline-block w-1.5 h-1.5 rounded-full bg-success animate-pulse-soft"
          />
        )}
      </Link>
    </Tooltip>
  )
}
