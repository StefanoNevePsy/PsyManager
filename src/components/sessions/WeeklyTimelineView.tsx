import { useRef, useEffect, useState, useCallback } from 'react'
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  addMinutes,
  getHours,
  getMinutes,
  isSameDay,
} from 'date-fns'
import { it } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui'
import { SessionWithRelations } from '@/hooks/useSessions'
import { getServiceColor } from '@/lib/serviceColors'
import { usePatientBalanceMap } from '@/hooks/usePayments'
import { sessionShortName, sessionDisplayName, SESSION_STATUS_LABELS } from '@/lib/sessionDisplay'

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
// Mobile hour height: tall enough that a 60-minute session block (56px) is
// comfortably tappable, well above the ~44px touch-target baseline.
const HOUR_HEIGHT_MOBILE = 56
// Each day gets its own scrollable column on mobile instead of being
// squeezed to a 1/7th share of the screen — wide enough to read a name and
// tap a session without missing.
const MOBILE_DAY_COL_WIDTH = 124
// A session shorter than this many px doesn't have room to also print the
// service name — time + patient name still fit at any height because the
// block enforces a minimum height below.
const MOBILE_SERVICE_NAME_MIN_HEIGHT = 64

export default function WeeklyTimelineView({
  currentDate,
  onDateChange,
  sessions,
  onSessionClick,
}: Props) {
  const isMobile = useIsMobile()
  const balanceMap = usePatientBalanceMap()
  const scrollRef = useRef<HTMLDivElement>(null)
  const dayColRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const hourHeight = isMobile ? HOUR_HEIGHT_MOBILE : HOUR_HEIGHT_DESKTOP
  // Mobile fits the working hours in a tall scrollable strip rather than a
  // cramped 24h grid; desktop keeps the full 24-hour grid scrollable so the
  // user can drag sessions to off-hours.
  const visibleHours = isMobile
    ? HOURS.filter((h) => h >= WORKING_HOURS_START && h <= WORKING_HOURS_END)
    : HOURS
  const visibleStart = isMobile ? WORKING_HOURS_START : 0
  const totalHours = visibleHours.length
  const bodyHeight = totalHours * hourHeight

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })

  // Mobile day-chip navigation: which day the horizontal strip is scrolled to.
  const [selectedDayKey, setSelectedDayKey] = useState(() => format(new Date(), 'yyyy-MM-dd'))

  const hoursColWidth = isMobile ? 36 : 56

  const scrollToDay = useCallback(
    (dayKey: string, behavior: ScrollBehavior = 'smooth') => {
      const container = scrollRef.current
      const target = dayColRefs.current[dayKey]
      if (!container || !target) return
      // Offset by the sticky hour column so it doesn't cover the day's
      // first minutes once scrolled into place.
      const left = Math.max(0, target.offsetLeft - hoursColWidth)
      container.scrollTo({ left, behavior })
    },
    [hoursColWidth]
  )

  // On desktop, pre-scroll to working hours on mount
  useEffect(() => {
    if (!isMobile && scrollRef.current) {
      scrollRef.current.scrollTop = WORKING_HOURS_START * hourHeight
    }
  }, [hourHeight, isMobile])

  // On mobile, whenever the visible week changes, snap the horizontal strip
  // to today (or the first day of the week if today isn't in it) so the
  // user doesn't land on Monday every time they open the agenda.
  useEffect(() => {
    if (!isMobile) return
    const today = new Date()
    const defaultDay = days.find((d) => isSameDay(d, today)) ?? days[0]
    const defaultKey = format(defaultDay, 'yyyy-MM-dd')
    setSelectedDayKey(defaultKey)
    // Defer to next frame so refs from this render are attached.
    const raf = requestAnimationFrame(() => scrollToDay(defaultKey, 'auto'))
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, weekStart.getTime()])

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
      minHeight: isMobile ? '44px' : '40px',
      rawHeight: height,
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Settimana precedente"
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
          size="icon"
          aria-label="Settimana successiva"
          onClick={() => onDateChange(new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000))}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Compact day chips — the primary way to navigate the week on
          mobile, since 7 columns no longer fit side by side. Tapping a
          chip scrolls the strip below to that day. */}
      <div className="grid grid-cols-7 gap-1 md:hidden">
        {days.map((day) => {
          const dayKey = format(day, 'yyyy-MM-dd')
          const isToday = isSameDay(day, new Date())
          const isSelected = dayKey === selectedDayKey
          return (
            <button
              key={dayKey}
              type="button"
              onClick={() => {
                setSelectedDayKey(dayKey)
                scrollToDay(dayKey)
              }}
              aria-pressed={isSelected}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-md py-1.5 pointer-coarse:min-h-[44px] transition-colors ${
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : isToday
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-secondary/60'
              }`}
            >
              <span className="text-[10px] uppercase tracking-wide leading-none opacity-80">
                {format(day, 'EEEEE', { locale: it })}
              </span>
              <span className="text-sm font-semibold leading-tight">{format(day, 'd')}</span>
            </button>
          )
        })}
      </div>

      {/* Single scroll container — hours and days move together. Sticky
          left column keeps hour labels visible during horizontal scroll;
          sticky top row keeps day headers visible during vertical scroll. */}
      <div
        ref={scrollRef}
        className="overflow-auto border border-border rounded-lg bg-card"
        style={{
          // Mobile now scrolls both ways (day strip + working hours), so
          // cap height to leave room for the chips row and page chrome
          // without overflowing the viewport on short screens.
          maxHeight: isMobile ? 'calc(100vh - 280px)' : '70vh',
        }}
      >
        <div
          className="grid"
          style={
            isMobile
              ? {
                  gridTemplateColumns: `${hoursColWidth}px repeat(7, ${MOBILE_DAY_COL_WIDTH}px)`,
                  width: 'max-content',
                }
              : {
                  gridTemplateColumns: `${hoursColWidth}px repeat(7, minmax(120px, 1fr))`,
                  width: '100%',
                }
          }
        >
          {/* Top-left corner (empty, masks where sticky header meets sticky col) */}
          <div className="sticky top-0 left-0 z-30 h-10 bg-card border-b border-r border-border" />

          {/* Day headers (sticky top) */}
          {days.map((day) => {
            const isToday = isSameDay(day, new Date())
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
            const dayKey = format(day, 'yyyy-MM-dd')
            const daySessions = getSessionsForDay(day)
            const isToday = isSameDay(day, new Date())

            return (
              <div
                key={day.toISOString()}
                ref={(el) => {
                  dayColRefs.current[dayKey] = el
                }}
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
                  const color = getServiceColor(session.service_type_id, session.service_types?.color)
                  const end = addMinutes(
                    new Date(session.scheduled_at),
                    session.duration_minutes
                  )
                  const bal = balanceMap.get(session.patient_id ?? session.group_id ?? '') || 0
                  const showBalDot = Math.abs(bal) >= 0.01
                  const inactive =
                    session.status === 'cancelled' || session.status === 'no_show'
                  const { rawHeight, ...blockStyle } = getSessionStyle(session)
                  const showServiceName = !isMobile || rawHeight >= MOBILE_SERVICE_NAME_MIN_HEIGHT
                  return (
                    <button
                      key={session.id}
                      onClick={() => onSessionClick(session)}
                      className={`absolute left-0.5 right-0.5 px-1.5 py-1 sm:p-2 rounded border text-left overflow-hidden transition-all hover:shadow-md cursor-pointer ${
                        inactive ? 'opacity-50' : ''
                      }`}
                      style={{
                        ...blockStyle,
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
                      )}—${format(end, 'HH:mm')} · ${sessionDisplayName(session)} · ${
                        session.service_types?.name ?? ''
                      }${inactive ? ` · ${SESSION_STATUS_LABELS[session.status]}` : ''}`}
                    >
                      <div className="text-[10px] sm:text-xs font-semibold leading-tight truncate">
                        {format(new Date(session.scheduled_at), 'HH:mm')}—{format(end, 'HH:mm')}
                      </div>
                      <div className="text-[10px] sm:text-2xs opacity-90 truncate leading-tight flex items-center gap-1">
                        <span className={`truncate ${inactive ? 'line-through' : ''}`}>
                          {sessionShortName(session)}
                        </span>
                        {showBalDot && (
                          <span
                            className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                              bal > 0 ? 'bg-destructive' : 'bg-success'
                            }`}
                          />
                        )}
                      </div>
                      {showServiceName && (
                        <div className="text-2xs opacity-75 truncate leading-tight">
                          {session.service_types?.name}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
