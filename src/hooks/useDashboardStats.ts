import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import {
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  startOfDay,
  addDays,
  format,
} from 'date-fns'
import { patientFullName, sessionDisplayName, isBillableStatus } from '@/lib/sessionDisplay'

export interface PatientBalanceLite {
  patientId: string
  patientName: string
  balance: number
  totalDue: number
  totalPaid: number
}

export interface DashboardStats {
  activePatients: number
  monthSessions: number
  monthIncome: number
  yearProjection: number
  todaySessions: Array<{
    id: string
    scheduled_at: string
    duration_minutes: number
    patientId: string
    patientName: string
    serviceName: string
    isPast: boolean
    patientBalance: number
  }>
  upcomingSessions: Array<{
    id: string
    scheduled_at: string
    duration_minutes: number
    patientId: string
    patientName: string
    serviceName: string
    patientBalance: number
  }>
  recentPayments: Array<{
    id: string
    amount: number
    payment_date: string
    patientName?: string
  }>
  outstandingBalances: PatientBalanceLite[]
}

const SESSION_WITH_RELATIONS_SELECT = '*, patients(*), service_types(*), patient_groups(*)'

export const useDashboardStats = () => {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['dashboard_stats', user?.id],
    queryFn: async (): Promise<DashboardStats> => {
      if (!user) {
        return {
          activePatients: 0,
          monthSessions: 0,
          monthIncome: 0,
          yearProjection: 0,
          todaySessions: [],
          upcomingSessions: [],
          recentPayments: [],
          outstandingBalances: [],
        }
      }

      const now = new Date()
      const nowMs = now.getTime()
      const monthStart = startOfMonth(now)
      const monthEnd = endOfMonth(now)
      const yearStart = startOfYear(now)
      const yearEnd = endOfYear(now)
      const today = startOfDay(now)
      const nextWeek = addDays(today, 7)

      const [
        { data: patients },
        { data: groups },
        { data: monthSessionsData },
        { data: monthPayments },
        { data: yearPayments },
        { data: todayData },
        { data: upcomingData },
        { data: recentPaymentsData },
        { data: allPastSessions },
        { data: allPayments },
      ] = await Promise.all([
        supabase.from('patients').select('id, first_name, last_name').eq('user_id', user.id),
        supabase.from('patient_groups').select('id, name').eq('user_id', user.id),
        supabase
          .from('sessions')
          .select('id, status')
          .eq('user_id', user.id)
          .gte('scheduled_at', monthStart.toISOString())
          .lte('scheduled_at', monthEnd.toISOString()),
        supabase
          .from('payments')
          .select('amount')
          .eq('user_id', user.id)
          .gte('payment_date', format(monthStart, 'yyyy-MM-dd'))
          .lte('payment_date', format(monthEnd, 'yyyy-MM-dd')),
        supabase
          .from('payments')
          .select('amount')
          .eq('user_id', user.id)
          .gte('payment_date', format(yearStart, 'yyyy-MM-dd'))
          .lte('payment_date', format(yearEnd, 'yyyy-MM-dd')),
        supabase
          .from('sessions')
          .select(SESSION_WITH_RELATIONS_SELECT)
          .eq('user_id', user.id)
          .gte('scheduled_at', today.toISOString())
          .lt('scheduled_at', addDays(today, 1).toISOString())
          .order('scheduled_at'),
        supabase
          .from('sessions')
          .select(SESSION_WITH_RELATIONS_SELECT)
          .eq('user_id', user.id)
          .gte('scheduled_at', addDays(today, 1).toISOString())
          .lte('scheduled_at', nextWeek.toISOString())
          .order('scheduled_at')
          .limit(5),
        supabase
          .from('payments')
          .select('*, patients(*), patient_groups(*)')
          .eq('user_id', user.id)
          .order('payment_date', { ascending: false })
          .limit(5),
        // For balance calculation: all past sessions (private only contribute to "due")
        supabase
          .from('sessions')
          .select('patient_id, group_id, status, service_types(price, type)')
          .eq('user_id', user.id)
          .lte('scheduled_at', now.toISOString()),
        // For balance calculation: all payments
        supabase
          .from('payments')
          .select('patient_id, group_id, amount')
          .eq('user_id', user.id),
      ])

      const monthSessions = (monthSessionsData || []).filter((s: any) =>
        isBillableStatus(s.status)
      )

      const monthIncome =
        monthPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0

      const yearIncome =
        yearPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0

      // Honest run-rate projection: YTD income / months elapsed * 12
      const monthsElapsed = now.getMonth() + 1
      const yearProjection = Math.round((yearIncome / monthsElapsed) * 12 * 100) / 100

      // Build per-entity (patient or group) balance map
      // Only count sessions that are truly completed: scheduled_at + duration_minutes < now
      const balanceMap = new Map<string, { totalDue: number; totalPaid: number }>()
      ;(allPastSessions || []).forEach((s: any) => {
        if (s.service_types?.type !== 'private') return
        if (!isBillableStatus(s.status)) return
        const entityId = s.patient_id ?? s.group_id
        if (!entityId) return
        const sessionStart = new Date(s.scheduled_at).getTime()
        const sessionEnd = sessionStart + (s.duration_minutes * 60 * 1000)
        // Only count if the session has ENDED
        if (sessionEnd > nowMs) return
        const price = Number(s.service_types?.price || 0)
        if (!balanceMap.has(entityId)) {
          balanceMap.set(entityId, { totalDue: 0, totalPaid: 0 })
        }
        balanceMap.get(entityId)!.totalDue += price
      })
      ;(allPayments || []).forEach((p: any) => {
        const entityId = p.patient_id ?? p.group_id
        if (!entityId) return
        if (!balanceMap.has(entityId)) {
          balanceMap.set(entityId, { totalDue: 0, totalPaid: 0 })
        }
        balanceMap.get(entityId)!.totalPaid += Number(p.amount)
      })

      const nameMap = new Map<string, string>()
      ;(patients || []).forEach((p: any) => {
        nameMap.set(p.id, patientFullName(p))
      })
      ;(groups || []).forEach((g: any) => {
        if (!nameMap.has(g.id)) nameMap.set(g.id, g.name)
      })

      const getBalance = (entityId: string): number => {
        const entry = balanceMap.get(entityId)
        if (!entry) return 0
        return entry.totalDue - entry.totalPaid
      }

      const outstandingBalances: PatientBalanceLite[] = Array.from(balanceMap.entries())
        .map(([entityId, b]) => ({
          patientId: entityId,
          patientName: nameMap.get(entityId) || 'Sconosciuto',
          balance: b.totalDue - b.totalPaid,
          totalDue: b.totalDue,
          totalPaid: b.totalPaid,
        }))
        .filter((b) => Math.abs(b.balance) >= 0.01)
        .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))

      const mapTodaySession = (s: any) => {
        const scheduledMs = new Date(s.scheduled_at).getTime()
        const entityId = s.patient_id ?? s.group_id ?? ''
        return {
          id: s.id,
          scheduled_at: s.scheduled_at,
          duration_minutes: s.duration_minutes,
          patientId: entityId,
          patientName: sessionDisplayName(s),
          serviceName: s.service_types?.name || '-',
          isPast: scheduledMs < nowMs,
          patientBalance: getBalance(entityId),
        }
      }

      // Order today's sessions: future first (closest to now), then past (most recent first)
      const mappedToday = (todayData || []).map(mapTodaySession)
      const futureToday = mappedToday
        .filter((s) => !s.isPast)
        .sort(
          (a, b) =>
            new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
        )
      const pastToday = mappedToday
        .filter((s) => s.isPast)
        .sort(
          (a, b) =>
            new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()
        )
      const orderedToday = [...futureToday, ...pastToday]

      const mapUpcomingSession = (s: any) => {
        const entityId = s.patient_id ?? s.group_id ?? ''
        return {
          id: s.id,
          scheduled_at: s.scheduled_at,
          duration_minutes: s.duration_minutes,
          patientId: entityId,
          patientName: sessionDisplayName(s),
          serviceName: s.service_types?.name || '-',
          patientBalance: getBalance(entityId),
        }
      }

      return {
        activePatients: patients?.length || 0,
        monthSessions: monthSessions?.length || 0,
        monthIncome,
        yearProjection,
        todaySessions: orderedToday,
        upcomingSessions: (upcomingData || []).map(mapUpcomingSession),
        recentPayments: (recentPaymentsData || []).map((p: any) => ({
          id: p.id,
          amount: Number(p.amount),
          payment_date: p.payment_date,
          patientName: p.group_id
            ? p.patient_groups?.name || 'Gruppo'
            : p.patients
              ? patientFullName(p.patients)
              : undefined,
        })),
        outstandingBalances,
      }
    },
    enabled: !!user,
  })
}
