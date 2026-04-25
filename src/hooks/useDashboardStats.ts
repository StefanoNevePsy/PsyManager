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

export interface DashboardStats {
  activePatients: number
  monthSessions: number
  monthIncome: number
  yearProjection: number
  todaySessions: Array<{
    id: string
    scheduled_at: string
    duration_minutes: number
    patientName: string
    serviceName: string
  }>
  upcomingSessions: Array<{
    id: string
    scheduled_at: string
    duration_minutes: number
    patientName: string
    serviceName: string
  }>
  recentPayments: Array<{
    id: string
    amount: number
    payment_date: string
    patientName?: string
  }>
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
      ] = await Promise.all([
        supabase.from('patients').select('id').eq('user_id', user.id),
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

      const mapSession = (s: any) => ({
        id: s.id,
        scheduled_at: s.scheduled_at,
        duration_minutes: s.duration_minutes,
        patientName: s.patients
          ? `${s.patients.last_name} ${s.patients.first_name}`
          : 'Sconosciuto',
        serviceName: s.service_types?.name || '-',
      })

      return {
        activePatients: patients?.length || 0,
        monthSessions: monthSessions?.length || 0,
        monthIncome,
        yearProjection,
        todaySessions: (todayData || []).map(mapSession),
        upcomingSessions: (upcomingData || []).map(mapSession),
        recentPayments: (recentPaymentsData || []).map((p: any) => ({
          id: p.id,
          amount: Number(p.amount),
          payment_date: p.payment_date,
          patientName: p.patients
            ? `${p.patients.last_name} ${p.patients.first_name}`
            : undefined,
        })),
      }
    },
    enabled: !!user,
  })
}
