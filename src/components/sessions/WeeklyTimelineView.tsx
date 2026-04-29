import { useRef, useEffect, useState } from 'react'
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
import { usePatientBalanceMap } from '@/hooks/usePayments'

// Helper to detect mobile breakpoint (matches Tailwind's md: 768px)
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth < 768
  )

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return isMobile
}

interface Props {
  currentDate: Date
  onDateChange: (date: Date) => void
  sessions: SessionWithRelations[]
  onSessionClick: (session: SessionWithRelations) => void
}

const HOURS = Array.from({ length: 24 }, (_, i) => i) // 0-23
const WORKING_HOURS_START = 8 // 08:00
const WORKING_HOURS_END = 21 // 21:00
const HOUR_HEIGHT_DESKTOP = 80 // px per hour on desktop
const HOUR_HEIGHT_MOBILE = 40 // px per hour on mobile/tablet

export default function WeeklyTimelineView({
  currentDate,
  onDateChange,
  sessions,
  onSessionClick,
}: Props) {
  const isMobile = useIsMobile()
  const balanceMap = usePatientBalanceMap()
  const scrollRef = useRef<HTMLDivElement>(null)

  const hourHeight = isMobile ? HOUR_HEIGHT_MOBILE : HOUR_HEIGHT_DESKTOP
  // Mobile fits all 7 days inside the viewport, so we render only working
  // hours (8–21) without vertical scroll. Desktop keeps the full 24-hour
  // grid scrollable so the user can drag sessions to off-hours.
  const visibleHours = isMobile
    ? HOURS.filter((h) => h >= WORKING_HOURS_START && h <= WORKING_HOURS_END)
    : HOURS
  const visibleStart = isMobile ? WORKING_HOURS_START : 0
  const totalHours = visibleHours.length
  const bodyHeight = totalHours * hourHeight

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })

  // On desktop, pre-scroll to working hours on mount
  useEffect(() => {
    if (!isMobile && scrollRef.current) {
      scrollRef.current.scrollTop = WORKING_HOURS_START * hourHeight
    }
  }, [hourHeight, isMobile])

  // Group sessions by day and calculate their position/height
  const getSessionsForDay = (day: Date) => {
    const dayKey = format(day, 'yyyy-MM-dd')
    return sessions.filter((s) => format(new Date(s.scheduled_at), 'yyyy-MM-dd') === dayKey)
  }

  const getSessionStyle = (session: SessionWithRelations) => {
    const start = new Date(session.scheduled_at)
    const offsetMinutes =
      (getHours(start) - visibleStart) * 60 + getMinutes(start)
    const top = (offsetMinutes / 60) * hourHeight
    const height = (session.duration_minutes / 60) * hourHeight

    return {
      top: `${top}px`,
      height: `${height}px`,
      minHeight: isMobile ? '32px' : '40px',
    }
  }

  const hoursColWidth = isMobile ? 36 : 56

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDateChange(new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000))}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h3 className="text-sm sm:text-base font-semibold">
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

      {/* Single scroll container — hours and days move together. Sticky
          left column keeps hour labels visible during horizontal scroll;
          sticky top row keeps day headers visible during vertical scroll. */}
      <div
        ref={scrollRef}
        className="overflow-auto border border-border rounded-lg bg-card"
        style={{
          // On mobile we render only working hours so vertical scroll is
          // typically unnecessary; cap height anyway to avoid overflowing
          // the viewport on very short screens.
          maxHeight: isMobile ? 'calc(100vh - 220px)' : '70vh',
        }}
      >
        <div
          className="grid"
          style={{
            gridTemplateColumns: `${hoursColWidth}px repeat(7, minmax(${
              isMobile ? '0' : '120px'
            }, 1fr))`,
            width: '100%',
          }}
        >
          {/* Top-left corner (empty, masks where sticky header meets sticky col) */}
          <div className="sticky top-0 left-0 z-30 h-10 bg-card border-b border-r border-border" />

          {/* Day headers (sticky top) */}
          {days.map((day) => {
            const isToday =
              format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
            return (
              <div
                key={day.toISOString()}
                className={`sticky top-0 z-20 h-10 flex flex-col items-center justify-center border-b border-l border-border text-xs ${
                  isToday ? 'bg-primary/10 text-primary' : 'bg-card'
                }`}
              >
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground leading-none">
                  {format(day, isMobile ? 'EEEEE' : 'EEE', { locale: it })}
                </span>
                <span
                  className={`text-sm font-semibold leading-tight ${
                    isToday ? 'text-primary' : ''
                  }`}
                >
                  {format(day, 'd')}
                </span>
              </div>
            )
          })}

          {/* Hour column + day cells. Render as one big body grid so hour
              labels stay aligned with their respective rows. */}
          <div
            className="sticky left-0 z-10 bg-card border-r border-border"
            style={{ height: `${bodyHeight}px` }}
          >
            {visibleHours.map((hour, i) => (
              <div
                key={hour}
                className="flex items-start justify-end pr-1.5 pt-0.5 text-[10px] font-medium text-muted-foreground border-b border-border/40"
                style={{ height: `${hourHeight}px` }}
              >
                {i === 0 ? null : `${String(hour).padStart(2, '0')}:00`}
              </div>
            ))}
          </div>

          {days.map((day) => {
            const daySessions = getSessionsForDay(day)
            const isToday =
              format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')

            return (
              <div
                key={day.toISOString()}
                className={`relative border-l border-border ${
                  isToday ? 'bg-primary/5' : ''
                }`}
                style={{ height: `${bodyHeight}px` }}
              >
                {/* Hour grid lines */}
                {visibleHours.map((hour, i) => (
                  <div
                    key={hour}
                    className="absolute w-full border-b border-border/40"
                    style={{
                      top: `${i * hourHeight}px`,
                      height: `${hourHeight}px`,
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
                  const bal = balanceMap.get(session.patient_id) || 0
                  const showBalDot = Math.abs(bal) >= 0.01
                  return (
                    <button
                      key={session.id}
                      onClick={() => onSessionClick(session)}
                      className="absolute left-0.5 right-0.5 px-1 py-0.5 sm:p-2 rounded border text-left overflow-hidden transition-all hover:shadow-md cursor-pointer"
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
                      title={`${format(
                        new Date(session.scheduled_at),
                        'HH:mm'
                      )}—${format(end, 'HH:mm')} · ${
                        session.patients?.last_name ?? ''
                      } · ${session.service_types?.name ?? ''}`}
                    >
                      <div className="text-[10px] sm:text-xs font-semibold leading-tight truncate">
                        {format(new Date(session.scheduled_at), 'HH:mm')}
                        {!isMobile && (
                          <>—{format(end, 'HH:mm')}</>
                        )}
                      </div>
                      <div className="text-[10px] sm:text-2xs opacity-90 truncate leading-tight flex items-center gap-1">
                        <span className="truncate">
                          {session.patients?.last_name}
                        </span>
                        {showBalDot && (
                          <span
                            className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                              bal > 0 ? 'bg-destructive' : 'bg-success'
                            }`}
                          />
                        )}
                      </div>
                      {!isMobile && (
                        <div className="text-2xs opacity-75 truncate leading-tight">
                          {session.service_types?.name}
                        </div>
                      )}
                    </button>
                  )
                })}
                {/* isToday flag is already applied via background tint */}
                {isToday && null}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
