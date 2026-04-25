import { format, isSameDay } from 'date-fns'
import { it } from 'date-fns/locale'
import { Clock, User, Edit, Trash2, Calendar } from 'lucide-react'
import { Button, EmptyState } from '@/components/ui'
import { SessionWithRelations } from '@/hooks/useSessions'

interface Props {
  sessions: SessionWithRelations[]
  onEdit: (session: SessionWithRelations) => void
  onDelete: (session: SessionWithRelations) => void
  emptyTitle?: string
  emptyDescription?: string
}

export default function SessionsList({
  sessions,
  onEdit,
  onDelete,
  emptyTitle = 'Nessuna seduta',
  emptyDescription = 'Non ci sono sedute in programma',
}: Props) {
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
        const date = new Date(day)
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
              {daySessions.map((session) => (
                <div
                  key={session.id}
                  className="border border-border rounded-lg p-4 hover:bg-secondary/50 transition-colors"
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
                        <span className="font-semibold truncate">
                          {session.patients?.last_name} {session.patients?.first_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            session.service_types?.type === 'private'
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                              : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                          }`}
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
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(session)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(session)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
