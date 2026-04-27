import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  addMinutes,
} from 'date-fns'
import { it } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui'
import { SessionWithRelations } from '@/hooks/useSessions'
import { getServiceColor } from '@/lib/serviceColors'

interface Props {
  currentDate: Date
  onDateChange: (date: Date) => void
  sessions: SessionWithRelations[]
  onSessionClick: (session: SessionWithRelations) => void
}

export default function WeeklyCalendarView({
  currentDate,
  onDateChange,
  sessions,
  onSessionClick,
}: Props) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })

  // Group sessions by day
  const sessionsByDay = sessions.reduce(
    (acc, session) => {
      const day = format(new Date(session.scheduled_at), 'yyyy-MM-dd')
      if (!acc[day]) acc[day] = []
      acc[day].push(session)
      return acc
    },
    {} as Record<string, SessionWithRelations[]>
  )

  // Calculate total time for each day
  const getTotalMinutes = (day: Date): number => {
    const dayKey = format(day, 'yyyy-MM-dd')
    return (sessionsByDay[dayKey] || []).reduce(
      (sum, s) => sum + s.duration_minutes,
      0
    )
  }

  const getHoursDisplay = (minutes: number): string => {
    if (minutes === 0) return '—'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h${mins > 0 ? ` ${mins}m` : ''}`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDateChange(new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000))}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h3 className="text-base font-semibold">
          {format(weekStart, 'd MMM', { locale: it })} —{' '}
          {format(weekEnd, 'd MMM yyyy', { locale: it })}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDateChange(new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000))}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const dayKey = format(day, 'yyyy-MM-dd')
          const daySessions = sessionsByDay[dayKey] || []
          const totalMins = getTotalMinutes(day)
          const isToday =
            format(day, 'yyyy-MM-dd') ===
            format(new Date(), 'yyyy-MM-dd')

          return (
            <div
              key={day.toISOString()}
              className={`rounded-lg border p-2 space-y-2 min-h-[180px] ${
                isToday
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-foreground/20'
              } transition-colors`}
            >
              {/* Day header */}
              <div className="text-center pb-1 border-b border-border/50">
                <p className="text-xs font-semibold text-muted-foreground uppercase">
                  {format(day, 'EEE', { locale: it })}
                </p>
                <p
                  className={`text-sm font-semibold ${
                    isToday ? 'text-primary' : 'text-foreground'
                  }`}
                >
                  {format(day, 'd')}
                </p>
              </div>

              {/* Sessions */}
              <div className="space-y-1">
                {daySessions.map((session) => {
                  const color = getServiceColor(session.service_type_id)
                  const endTime = addMinutes(
                    new Date(session.scheduled_at),
                    session.duration_minutes
                  )
                  return (
                    <button
                      key={session.id}
                      onClick={() => onSessionClick(session)}
                      className="w-full text-left text-xs p-1 rounded transition-colors border"
                      style={color.pillStyle}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor =
                          color.pillHoverStyle.backgroundColor
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor =
                          color.pillStyle.backgroundColor
                      }}
                      title={`${session.patients?.last_name} — ${session.service_types?.name}`}
                    >
                      <div className="font-semibold">
                        {format(new Date(session.scheduled_at), 'HH:mm')}—
                        {format(endTime, 'HH:mm')}
                      </div>
                      <div className="truncate text-2xs opacity-90">
                        {session.patients?.last_name}
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Total time */}
              {totalMins > 0 && (
                <div className="pt-1 border-t border-border/50 text-center text-2xs text-muted-foreground">
                  {getHoursDisplay(totalMins)}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
