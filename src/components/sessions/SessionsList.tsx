import { useEffect, useMemo, useRef, useState } from 'react'
import { format, isSameDay } from 'date-fns'
import { it } from 'date-fns/locale'
import {
  Clock,
  User,
  Edit,
  Trash2,
  Calendar,
  DollarSign,
} from 'lucide-react'
import { Button, EmptyState, Tooltip, useToast } from '@/components/ui'
import { SessionWithRelations } from '@/hooks/useSessions'
import { useBillingStatus, useSetInvoiceExempt, BillingStatusRow } from '@/hooks/useBillingStatus'
import { getServiceColor } from '@/lib/serviceColors'
import { usePatientBalanceMap } from '@/hooks/usePayments'
import { sessionDisplayName, SESSION_STATUS_LABELS } from '@/lib/sessionDisplay'
import BalanceDot from '@/components/payments/BalanceDot'
import SessionStatusControl from '@/components/sessions/SessionStatusControl'

/**
 * Billing badge for a single session row: shows where it stands re:
 * invoicing, and — for the two actionable states — a tiny menu to toggle
 * the manual "no invoice needed" exemption. 'not_due' renders nothing.
 */
function BillingBadge({ sessionId, row }: { sessionId: string; row: BillingStatusRow | undefined }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const setExempt = useSetInvoiceExempt()
  const { toast } = useToast()

  useEffect(() => {
    if (!menuOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  const status = row?.billing_status
  if (!status || status === 'not_due') return null

  const isPending = setExempt.isPending && setExempt.variables?.id === sessionId

  const handleToggleExempt = async (event: React.MouseEvent, exempt: boolean) => {
    event.stopPropagation()
    setMenuOpen(false)
    try {
      await setExempt.mutateAsync({ id: sessionId, exempt })
      toast.success(exempt ? 'Seduta segnata come senza fattura' : 'Esenzione rimossa')
    } catch {
      toast.error("Errore durante l'aggiornamento dello stato di fatturazione")
    }
  }

  if (status === 'invoiced') {
    return (
      <Tooltip
        label={
          row.receipt_date
            ? `Emessa il ${format(new Date(row.receipt_date), 'd MMM yyyy', { locale: it })}`
            : 'Fatturata'
        }
      >
        <span className="inline-flex items-center text-2xs font-semibold px-2 py-1 rounded-full border text-success bg-success-soft border-success/30 whitespace-nowrap">
          Fatt. {row.receipt_number}/{row.receipt_year}
        </span>
      </Tooltip>
    )
  }

  if (status === 'cash') {
    return (
      <Tooltip label="Pagata in contanti: nessuna fattura dovuta">
        <span className="inline-flex items-center text-2xs font-semibold px-2 py-1 rounded-full border text-muted-foreground bg-secondary/60 border-border whitespace-nowrap">
          Contanti
        </span>
      </Tooltip>
    )
  }

  const isExempt = status === 'exempt'

  return (
    <div className="relative flex-shrink-0" ref={containerRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setMenuOpen((v) => !v)
        }}
        disabled={isPending}
        aria-haspopup="true"
        aria-expanded={menuOpen}
        className={`inline-flex items-center text-2xs font-semibold px-2 py-1 rounded-full border transition-colors disabled:opacity-50 disabled:cursor-wait whitespace-nowrap ${
          isExempt
            ? 'text-muted-foreground bg-secondary/60 border-border'
            : 'text-warning bg-warning-soft border-warning/30'
        }`}
      >
        {isExempt ? 'Senza fattura' : 'Da fatturare'}
      </button>
      {menuOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute z-30 mt-1 right-0 origin-top-right w-52 bg-popover border border-border rounded-lg shadow-pop overflow-hidden animate-scale-in"
        >
          {isExempt ? (
            <button
              type="button"
              onClick={(e) => handleToggleExempt(e, false)}
              className="w-full flex items-center px-3 py-2 text-sm text-left hover:bg-secondary transition-colors text-popover-foreground"
            >
              Rimuovi esenzione
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => handleToggleExempt(e, true)}
              className="w-full flex items-center px-3 py-2 text-sm text-left hover:bg-secondary transition-colors text-popover-foreground"
            >
              Segna come senza fattura
            </button>
          )}
        </div>
      )}
    </div>
  )
}

interface Props {
  sessions: SessionWithRelations[]
  onEdit: (session: SessionWithRelations) => void
  onDelete: (session: SessionWithRelations) => void
  onPay?: (session: SessionWithRelations) => void
  emptyTitle?: string
  emptyDescription?: string
}

export default function SessionsList({
  sessions,
  onEdit,
  onDelete,
  onPay,
  emptyTitle = 'Nessuna seduta',
  emptyDescription = 'Non ci sono sedute in programma',
}: Props) {
  const balanceMap = usePatientBalanceMap()
  const sessionIds = useMemo(() => sessions.map((s) => s.id), [sessions])
  const { data: billingMap = new Map<string, BillingStatusRow>() } = useBillingStatus(sessionIds)
  if (sessions.length === 0) {
    return (
      <EmptyState
        icon={Calendar}
        title={emptyTitle}
        description={emptyDescription}
      />
    )
  }

  // Group sessions by day
  const grouped = sessions.reduce(
    (acc, session) => {
      const day = format(new Date(session.scheduled_at), 'yyyy-MM-dd')
      if (!acc[day]) acc[day] = []
      acc[day].push(session)
      return acc
    },
    {} as Record<string, SessionWithRelations[]>
  )

  const today = new Date()

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([day, daySessions]) => {
        // Parse the 'yyyy-MM-dd' key as LOCAL midnight — new Date('yyyy-MM-dd')
        // would parse as UTC and shift the header a day for west-of-UTC users
        const [y, m, d] = day.split('-').map(Number)
        const date = new Date(y, m - 1, d)
        const isToday = isSameDay(date, today)
        return (
          <div key={day}>
            <h3
              className={`text-sm font-semibold mb-3 capitalize ${
                isToday ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              {format(date, "EEEE d MMMM yyyy", { locale: it })}
              {isToday && ' (oggi)'}
            </h3>
            <div className="space-y-2">
              {daySessions.map((session) => {
                const color = getServiceColor(session.service_type_id, session.service_types?.color)
                const inactive =
                  session.status === 'cancelled' || session.status === 'no_show'
                return (
                <div
                  key={session.id}
                  className={`border-l-4 border border-border rounded-lg p-4 hover:bg-secondary/50 transition-colors ${
                    inactive ? 'opacity-60' : ''
                  }`}
                  style={{ borderLeftColor: color.hex }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm font-medium">
                          {format(new Date(session.scheduled_at), 'HH:mm')}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({session.duration_minutes} min)
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span
                          className={`font-semibold truncate ${
                            session.status === 'cancelled' ? 'line-through' : ''
                          }`}
                        >
                          {sessionDisplayName(session)}
                        </span>
                        {inactive && (
                          <span className="text-2xs px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-semibold uppercase tracking-wider flex-shrink-0">
                            {SESSION_STATUS_LABELS[session.status]}
                          </span>
                        )}
                        <BalanceDot
                          balance={
                            balanceMap.get(session.patient_id ?? session.group_id ?? '') || 0
                          }
                        />
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full border"
                          style={color.pillStyle}
                        >
                          {session.service_types?.name}
                        </span>
                        {session.service_types?.type === 'private' && (
                          <span className="text-muted-foreground">
                            € {Number(session.service_types.price).toFixed(2)}
                          </span>
                        )}
                      </div>
                      {session.notes && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                          {session.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <BillingBadge sessionId={session.id} row={billingMap.get(session.id)} />
                      <SessionStatusControl sessionId={session.id} status={session.status} />
                      {onPay && session.service_types?.type === 'private' && (
                        <Tooltip label="Registra pagamento">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onPay(session)}
                          >
                            <DollarSign className="w-4 h-4" />
                          </Button>
                        </Tooltip>
                      )}
                      <Tooltip label="Modifica">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(session)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </Tooltip>
                      <Tooltip label="Elimina">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(session)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </Tooltip>
                    </div>
                  </div>
                </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
