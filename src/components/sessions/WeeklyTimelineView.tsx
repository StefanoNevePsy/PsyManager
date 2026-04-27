import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  addMinutes,
  getHours,
  getMinutes,
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

const HOURS = Array.from({ length: 24 }, (_, i) => i) // 0-23

export default function WeeklyTimelineView({
  currentDate,
  onDateChange,
  sessions,
  onSessionClick,
}: Props) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })

  // Group sessions by day and calculate their position/height
  const getSessionsForDay = (day: Date) => {
    const dayKey = format(day, 'yyyy-MM-dd')
    return sessions.filter((s) => format(new Date(s.scheduled_at), 'yyyy-MM-dd') === dayKey)
  }

  const getSessionStyle = (session: SessionWithRelations) => {
    const start = new Date(session.scheduled_at)
    const topOffsetMinutes = getHours(start) * 60 + getMinutes(start)
    const topPercent = (topOffsetMinutes / (24 * 60)) * 100
    const heightPercent = (session.duration_minutes / (24 * 60)) * 100

    return {
      top: `${topPercent}%`,
      height: `${heightPercent}%`,
      minHeight: '40px', // minimum visual height
    }
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

      {/* Timeline container */}
      <div className="overflow-x-auto border border-border rounded-lg">
        <div className="flex">
          {/* Hours column (left) */}
          <div className="flex flex-col border-r border-border bg-muted/30 flex-shrink-0">
            <div className="h-12 flex items-center justify-center text-xs font-medium text-muted-foreground border-b border-border px-2 w-12" />
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="h-20 flex items-center justify-center text-xs font-medium text-muted-foreground border-b border-border/50 w-12 flex-shrink-0"
              >
                {String(hour).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Days columns */}
          <div className="flex flex-1 divide-x divide-border">
            {days.map((day) => {
              const daySessions = getSessionsForDay(day)
              const isToday =
                format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')

              return (
                <div
                  key={day.toISOString()}
                  className={`flex-1 min-w-[200px] relative ${
                    isToday ? 'bg-primary/5' : ''
                  }`}
                >
                  {/* Day header */}
                  <div
                    className={`h-12 flex items-center justify-center border-b border-border text-sm font-semibold ${
                      isToday ? 'bg-primary/10 text-primary' : 'bg-card'
                    }`}
                  >
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground uppercase">
                        {format(day, 'EEE', { locale: it })}
                      </p>
                      <p className={isToday ? 'text-primary' : ''}>{format(day, 'd')}</p>
                    </div>
                  </div>

                  {/* Hour rows */}
                  <div className="relative h-[1920px]">
                    {/* Grid lines for each hour */}
                    {HOURS.map((hour) => (
                      <div
                        key={hour}
                        className="absolute h-20 w-full border-b border-border/30"
                        style={{
                          top: `${(hour / 24) * 100}%`,
                        }}
                      />
                    ))}

                    {/* Session blocks */}
                    {daySessions.map((session) => {
                      const color = getServiceColor(session.service_type_id)
                      const end = addMinutes(
                        new Date(session.scheduled_at),
                        session.duration_minutes
                      )
                      return (
                        <button
                          key={session.id}
                          onClick={() => onSessionClick(session)}
                          className="absolute w-11/12 left-1/2 transform -translate-x-1/2 p-2 rounded border transition-all hover:shadow-md cursor-pointer"
                          style={{
                            ...getSessionStyle(session),
                            ...color.pillStyle,
                            borderColor: color.hex,
                          }}
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
                          <div className="text-xs font-semibold leading-tight">
                            {format(new Date(session.scheduled_at), 'HH:mm')}—
                            {format(end, 'HH:mm')}
                          </div>
                          <div className="text-2xs opacity-90 truncate leading-tight">
                            {session.patients?.last_name}
                          </div>
                          <div className="text-2xs opacity-75 truncate leading-tight">
                            {session.service_types?.name}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
