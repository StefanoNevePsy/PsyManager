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
} from 'date-fns'

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
      const monthStart = startOfMonth(now)
      const monthEnd = endOfMonth(now)
      const yearStart = startOfYear(now)
      const yearEnd = endOfYear(now)
      const today = startOfDay(now)
      const nextWeek = addDays(today, 7)

      const [
        { data: patients },
        { data: monthSessions },
        { data: monthPayments },
        { data: yearPayments },
        { data: yearScheduledSessions },
        { data: todayData },
        { data: upcomingData },
        { data: recentPaymentsData },
        { data: allPastSessions },
        { data: allPayments },
      ] = await Promise.all([
        supabase.from('patients').select('id, first_name, last_name').eq('user_id', user.id),
        supabase
          .from('sessions')
          .select('id')
          .eq('user_id', user.id)
          .gte('scheduled_at', monthStart.toISOString())
          .lte('scheduled_at', monthEnd.toISOString()),
        supabase
          .from('payments')
          .select('amount')
          .eq('user_id', user.id)
          .gte('payment_date', monthStart.toISOString().split('T')[0])
          .lte('payment_date', monthEnd.toISOString().split('T')[0]),
        supabase
          .from('payments')
          .select('amount')
          .eq('user_id', user.id)
          .gte('payment_date', yearStart.toISOString().split('T')[0])
          .lte('payment_date', yearEnd.toISOString().split('T')[0]),
        supabase
          .from('sessions')
          .select('*, service_types(price, type)')
          .eq('user_id', user.id)
          .gte('scheduled_at', yearStart.toISOString())
          .lte('scheduled_at', yearEnd.toISOString()),
        supabase
          .from('sessions')
          .select('*, patients(*), service_types(*)')
          .eq('user_id', user.id)
          .gte('scheduled_at', today.toISOString())
          .lt('scheduled_at', addDays(today, 1).toISOString())
          .order('scheduled_at'),
        supabase
          .from('sessions')
          .select('*, patients(*), service_types(*)')
          .eq('user_id', user.id)
          .gte('scheduled_at', addDays(today, 1).toISOString())
          .lte('scheduled_at', nextWeek.toISOString())
          .order('scheduled_at')
          .limit(5),
        supabase
          .from('payments')
          .select('*, patients(*)')
          .eq('user_id', user.id)
          .order('payment_date', { ascending: false })
          .limit(5),
        // For balance calculation: all past sessions (private only contribute to "due")
        supabase
          .from('sessions')
          .select('patient_id, service_types(price, type)')
          .eq('user_id', user.id)
          .lte('scheduled_at', now.toISOString()),
        // For balance calculation: all payments
        supabase
          .from('payments')
          .select('patient_id, amount')
          .eq('user_id', user.id),
      ])

      const monthIncome =
        monthPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0

      const yearIncome =
        yearPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0

      const projectedFromSessions =
        yearScheduledSessions
          ?.filter((s: any) => s.service_types?.type === 'private')
          .reduce(
            (sum: number, s: any) =>
              sum + Number(s.service_types?.price || 0),
            0
          ) || 0

      const yearProjection = Math.max(yearIncome, projectedFromSessions)

      // Build per-patient balance map
      const balanceMap = new Map<string, { totalDue: number; totalPaid: number }>()
      ;(allPastSessions || []).forEach((s: any) => {
        if (s.service_types?.type !== 'private') return
        const price = Number(s.service_types?.price || 0)
        if (!balanceMap.has(s.patient_id)) {
          balanceMap.set(s.patient_id, { totalDue: 0, totalPaid: 0 })
        }
        balanceMap.get(s.patient_id)!.totalDue += price
      })
      ;(allPayments || []).forEach((p: any) => {
        if (!p.patient_id) return
        if (!balanceMap.has(p.patient_id)) {
          balanceMap.set(p.patient_id, { totalDue: 0, totalPaid: 0 })
        }
        balanceMap.get(p.patient_id)!.totalPaid += Number(p.amount)
      })

      const patientNameMap = new Map<string, string>()
      ;(patients || []).forEach((p: any) => {
        patientNameMap.set(p.id, `${p.last_name} ${p.first_name}`)
      })

      const getBalance = (patientId: string): number => {
        const entry = balanceMap.get(patientId)
        if (!entry) return 0
        return entry.totalDue - entry.totalPaid
      }

      const outstandingBalances: PatientBalanceLite[] = Array.from(balanceMap.entries())
        .map(([patientId, b]) => ({
          patientId,
          patientName: patientNameMap.get(patientId) || 'Sconosciuto',
          balance: b.totalDue - b.totalPaid,
          totalDue: b.totalDue,
          totalPaid: b.totalPaid,
        }))
        .filter((b) => Math.abs(b.balance) >= 0.01)
        .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))

      const nowMs = now.getTime()

      const mapTodaySession = (s: any) => {
        const scheduledMs = new Date(s.scheduled_at).getTime()
        return {
          id: s.id,
          scheduled_at: s.scheduled_at,
          duration_minutes: s.duration_minutes,
          patientId: s.patient_id,
          patientName: s.patients
            ? `${s.patients.last_name} ${s.patients.first_name}`
            : 'Sconosciuto',
          serviceName: s.service_types?.name || '-',
          isPast: scheduledMs < nowMs,
          patientBalance: getBalance(s.patient_id),
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

      const mapUpcomingSession = (s: any) => ({
        id: s.id,
        scheduled_at: s.scheduled_at,
        duration_minutes: s.duration_minutes,
        patientId: s.patient_id,
        patientName: s.patients
          ? `${s.patients.last_name} ${s.patients.first_name}`
          : 'Sconosciuto',
        serviceName: s.service_types?.name || '-',
        patientBalance: getBalance(s.patient_id),
      })

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
          patientName: p.patients
            ? `${p.patients.last_name} ${p.patients.first_name}`
            : undefined,
        })),
        outstandingBalances,
      }
    },
    enabled: !!user,
  })
}
