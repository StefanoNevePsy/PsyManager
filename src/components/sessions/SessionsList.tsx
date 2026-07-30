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
import { Button, EmptyState, Tooltip } from '@/components/ui'
import { SessionWithRelations } from '@/hooks/useSessions'
import { getServiceColor } from '@/lib/serviceColors'
import { usePatientBalanceMap } from '@/hooks/usePayments'
import { sessionDisplayName, SESSION_STATUS_LABELS } from '@/lib/sessionDisplay'
import BalanceDot from '@/components/payments/BalanceDot'
import SessionStatusControl from '@/components/sessions/SessionStatusControl'

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
