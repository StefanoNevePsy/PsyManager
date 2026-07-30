import { useEffect, useRef, useState } from 'react'
import {
  CalendarClock,
  CheckCircle2,
  XCircle,
  UserX,
  type LucideIcon,
} from 'lucide-react'
import { useToast } from '@/components/ui'
import { useUpdateSessionStatus } from '@/hooks/useSessions'
import { SESSION_STATUS_LABELS } from '@/lib/sessionDisplay'
import { SessionStatus } from '@/types/database'

// Icon + look for each status. 'scheduled' reads as a neutral "still to do"
// rather than an explicit label.
export const STATUS_META: Record<
  SessionStatus,
  { label: string; icon: LucideIcon; className: string }
> = {
  scheduled: {
    label: 'Da svolgere',
    icon: CalendarClock,
    className: 'text-muted-foreground bg-secondary/60 border-border',
  },
  completed: {
    label: SESSION_STATUS_LABELS.completed,
    icon: CheckCircle2,
    className: 'text-success bg-success-soft border-success/30',
  },
  cancelled: {
    label: SESSION_STATUS_LABELS.cancelled,
    icon: XCircle,
    className: 'text-destructive bg-destructive-soft border-destructive/30',
  },
  no_show: {
    label: SESSION_STATUS_LABELS.no_show,
    icon: UserX,
    className: 'text-warning bg-warning-soft border-warning/30',
  },
}

const STATUS_OPTIONS = Object.keys(STATUS_META) as SessionStatus[]

interface Props {
  sessionId: string
  /** May be missing on data restored from an older persisted cache */
  status: SessionStatus | null | undefined
  /** Hide the label and show only the icon (tight rows) */
  compact?: boolean
  /** Where the menu opens from — use 'left' inside right-aligned rows */
  align?: 'left' | 'right'
}

/**
 * Compact popover to change a session's status in one tap. Usable inside
 * clickable rows: every interaction stops propagation so the row's own
 * onClick never fires.
 */
export default function SessionStatusControl({
  sessionId,
  status,
  compact = false,
  align = 'right',
}: Props) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const updateStatus = useUpdateSessionStatus()
  const { toast } = useToast()

  useEffect(() => {
    if (!isMenuOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isMenuOpen])

  // Data restored from a cache written before the status column existed has
  // no status: fall back instead of crashing the whole tree.
  const currentStatus: SessionStatus = status ?? 'scheduled'

  const isPending = updateStatus.isPending && updateStatus.variables?.id === sessionId

  const handleSelect = async (
    event: React.MouseEvent,
    nextStatus: SessionStatus
  ) => {
    event.stopPropagation()
    setIsMenuOpen(false)
    if (nextStatus === currentStatus) return
    try {
      await updateStatus.mutateAsync({ id: sessionId, status: nextStatus })
      toast.success(`Stato aggiornato a "${STATUS_META[nextStatus].label}"`)
    } catch {
      toast.error("Errore durante l'aggiornamento dello stato")
    }
  }

  const meta = STATUS_META[currentStatus] ?? STATUS_META.scheduled
  const Icon = meta.icon

  return (
    <div className="relative flex-shrink-0" ref={containerRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setIsMenuOpen((v) => !v)
        }}
        disabled={isPending}
        aria-haspopup="true"
        aria-expanded={isMenuOpen}
        title={compact ? meta.label : undefined}
        className={`inline-flex items-center gap-1.5 text-2xs font-semibold px-2 py-1 rounded-full border transition-colors disabled:opacity-50 disabled:cursor-wait ${meta.className}`}
      >
        <Icon className="w-3.5 h-3.5" strokeWidth={2} />
        {!compact && meta.label}
      </button>
      {isMenuOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`absolute z-30 mt-1 w-40 bg-popover border border-border rounded-lg shadow-pop overflow-hidden animate-scale-in ${
            align === 'right' ? 'right-0 origin-top-right' : 'left-0 origin-top-left'
          }`}
        >
          {STATUS_OPTIONS.map((option) => {
            const optionMeta = STATUS_META[option]
            const OptionIcon = optionMeta.icon
            const selected = option === currentStatus
            return (
              <button
                key={option}
                type="button"
                onClick={(e) => handleSelect(e, option)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-secondary transition-colors ${
                  selected ? 'font-semibold text-foreground' : 'text-popover-foreground'
                }`}
              >
                <OptionIcon className="w-4 h-4 flex-shrink-0" strokeWidth={1.85} />
                {optionMeta.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
