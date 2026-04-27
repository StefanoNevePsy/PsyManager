import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
} from 'date-fns'
import { it } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui'
import { SessionWithRelations } from '@/hooks/useSessions'
import { getServiceColor } from '@/lib/serviceColors'
import { usePatientBalanceMap } from '@/hooks/usePayments'

interface Props {
  currentDate: Date
  onDateChange: (date: Date) => void
  sessions: SessionWithRelations[]
  onDayClick: (date: Date) => void
  onSessionClick: (session: SessionWithRelations) => void
}

export default function CalendarView({
  currentDate,
  onDateChange,
  sessions,
  onDayClick,
  onSessionClick,
}: Props) {
  const balanceMap = usePatientBalanceMap()
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  const weekDays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

  const sessionsByDay = sessions.reduce(
    (acc, session) => {
      const day = format(new Date(session.scheduled_at), 'yyyy-MM-dd')
      if (!acc[day]) acc[day] = []
      acc[day].push(session)
      return acc
    },
    {} as Record<string, SessionWithRelations[]>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => onDateChange(subMonths(currentDate, 1))}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h3 className="text-lg font-semibold capitalize">
          {format(currentDate, 'MMMM yyyy', { locale: it })}
        </h3>
        <Button
          variant="ghost"
          onClick={() => onDateChange(addMonths(currentDate, 1))}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-7 bg-secondary border-b border-border">
          {weekDays.map((day) => (
            <div
              key={day}
              className="text-center text-xs md:text-sm font-medium py-2 text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 auto-rows-fr">
          {days.map((day) => {
            const dayKey = format(day, 'yyyy-MM-dd')
            const daySessions = sessionsByDay[dayKey] || []
            const isCurrentMonth = isSameMonth(day, currentDate)
            const isCurrentDay = isToday(day)

            return (
              <button
                key={day.toISOString()}
                onClick={() => onDayClick(day)}
                className={`min-h-[80px] md:min-h-[100px] border-r border-b border-border p-1 md:p-2 text-left hover:bg-secondary/50 transition-colors ${
                  !isCurrentMonth ? 'bg-secondary/20 text-muted-foreground' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-xs md:text-sm font-medium ${
                      isCurrentDay
                        ? 'bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center'
                        : ''
                    }`}
                  >
                    {format(day, 'd')}
                  </span>
                </div>

                <div className="space-y-1">
                  {daySessions.slice(0, 3).map((session) => {
                    const color = getServiceColor(session.service_type_id)
                    return (
                      <div
                        key={session.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          onSessionClick(session)
                        }}
                        title={session.service_types?.name}
                        className="text-xs px-1 py-0.5 rounded truncate cursor-pointer border transition-colors"
                        style={color.pillStyle}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor =
                            color.pillHoverStyle.backgroundColor
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor =
                            color.pillStyle.backgroundColor
                        }}
                      >
                        <span className="font-medium">
                          {format(new Date(session.scheduled_at), 'HH:mm')}
                        </span>{' '}
                        {session.patients?.last_name}
                        {(() => {
                          const bal = balanceMap.get(session.patient_id) || 0
                          if (Math.abs(bal) < 0.01) return null
                          return (
                            <span
                              className={`inline-block w-1.5 h-1.5 rounded-full ml-1 align-middle ${
                                bal > 0 ? 'bg-destructive' : 'bg-success'
                              }`}
                            />
                          )
                        })()}
                      </div>
                    )
                  })}
                  {daySessions.length > 3 && (
                    <div className="text-xs text-muted-foreground">
                      +{daySessions.length - 3} altre
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
