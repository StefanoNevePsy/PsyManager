import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import {
  startOfMonth,
  format,
  eachMonthOfInterval,
  subMonths,
} from 'date-fns'

export interface ReportData {
  totalIncome: number
  totalSessions: number
  byServiceType: Array<{
    name: string
    type: 'private' | 'package'
    count: number
    income: number
  }>
  byPatient: Array<{
    name: string
    sessionsCount: number
    income: number
  }>
  monthlyTrend: Array<{
    month: string
    income: number
    sessions: number
  }>
  payments: Array<{
    date: string
    amount: number
    patientName: string
    method: string
    notes: string
  }>
}

export const useReports = (startDate: Date, endDate: Date) => {
  const { user } = useAuth()

  return useQuery({
    queryKey: [
      'reports',
      user?.id,
      startDate.toISOString(),
      endDate.toISOString(),
    ],
    queryFn: async (): Promise<ReportData> => {
      if (!user) {
        return {
          totalIncome: 0,
          totalSessions: 0,
          byServiceType: [],
          byPatient: [],
          monthlyTrend: [],
          payments: [],
        }
      }

      const startStr = startDate.toISOString().split('T')[0]
      const endStr = endDate.toISOString().split('T')[0]

      const [
        { data: payments },
        { data: sessions },
      ] = await Promise.all([
        supabase
          .from('payments')
          .select('*, patients(*)')
          .eq('user_id', user.id)
          .gte('payment_date', startStr)
          .lte('payment_date', endStr),
        supabase
          .from('sessions')
          .select('*, patients(*), service_types(*)')
          .eq('user_id', user.id)
          .gte('scheduled_at', startDate.toISOString())
          .lte('scheduled_at', endDate.toISOString()),
      ])

      const totalIncome =
        payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0
      const totalSessions = sessions?.length || 0

      // By service type
      const serviceTypeMap = new Map<
        string,
        { name: string; type: 'private' | 'package'; count: number; income: number }
      >()

      for (const session of sessions || []) {
        if (!session.service_types) continue
        const key = session.service_type_id
        const existing = serviceTypeMap.get(key) || {
          name: session.service_types.name,
          type: session.service_types.type,
          count: 0,
          income: 0,
        }
        existing.count += 1
        if (session.service_types.type === 'private') {
          existing.income += Number(session.service_types.price)
        }
        serviceTypeMap.set(key, existing)
      }

      // By patient
      const patientMap = new Map<
        string,
        { name: string; sessionsCount: number; income: number }
      >()

      for (const session of sessions || []) {
        if (!session.patients) continue
        const key = session.patient_id
        const existing = patientMap.get(key) || {
          name: `${session.patients.last_name} ${session.patients.first_name}`,
          sessionsCount: 0,
          income: 0,
        }
        existing.sessionsCount += 1
        if (session.service_types?.type === 'private') {
          existing.income += Number(session.service_types.price)
        }
        patientMap.set(key, existing)
      }

      for (const payment of payments || []) {
        if (!payment.patient_id || !payment.patients) continue
        const key = payment.patient_id
        const existing = patientMap.get(key)
        if (existing) {
          // already counted above
        }
      }

      // Monthly trend (last 6 months)
      const trendStart = subMonths(startOfMonth(new Date()), 5)
      const months = eachMonthOfInterval({
        start: trendStart,
        end: new Date(),
      })

      const { data: trendPayments } = await supabase
        .from('payments')
        .select('amount, payment_date')
        .eq('user_id', user.id)
        .gte('payment_date', trendStart.toISOString().split('T')[0])

      const { data: trendSessions } = await supabase
        .from('sessions')
        .select('scheduled_at')
        .eq('user_id', user.id)
        .gte('scheduled_at', trendStart.toISOString())

      const monthlyTrend = months.map((month) => {
        const monthKey = format(month, 'yyyy-MM')
        const monthIncome =
          trendPayments
            ?.filter((p) => p.payment_date.startsWith(monthKey))
            .reduce((sum, p) => sum + Number(p.amount), 0) || 0
        const monthSessionsCount =
          trendSessions?.filter((s) =>
            s.scheduled_at.startsWith(monthKey)
          ).length || 0

        return {
          month: format(month, 'MMM yyyy'),
          income: monthIncome,
          sessions: monthSessionsCount,
        }
      })

      // Payments list
      const paymentsList = (payments || []).map((p) => ({
        date: p.payment_date,
        amount: Number(p.amount),
        patientName: p.patients
          ? `${p.patients.last_name} ${p.patients.first_name}`
          : '-',
        method: p.payment_method,
        notes: p.notes || '',
      }))

      return {
        totalIncome,
        totalSessions,
        byServiceType: Array.from(serviceTypeMap.values()).sort(
          (a, b) => b.income - a.income
        ),
        byPatient: Array.from(patientMap.values())
          .sort((a, b) => b.income - a.income)
          .slice(0, 20),
        monthlyTrend,
        payments: paymentsList,
      }
    },
    enabled: !!user,
  })
}

export const exportToCSV = (data: ReportData, filename: string) => {
  const lines: string[] = []

  lines.push('REPORT PSYMANAGER')
  lines.push('')
  lines.push(`Totale Incassato,${data.totalIncome.toFixed(2)}`)
  lines.push(`Totale Sedute,${data.totalSessions}`)
  lines.push('')
  lines.push('GUADAGNI PER TIPO DI PRESTAZIONE')
  lines.push('Nome,Tipo,Sedute,Incasso')
  for (const item of data.byServiceType) {
    lines.push(
      `"${item.name}","${item.type === 'private' ? 'Privato' : 'Pacchetto'}",${item.count},${item.income.toFixed(2)}`
    )
  }
  lines.push('')
  lines.push('GUADAGNI PER PAZIENTE')
  lines.push('Paziente,Sedute,Incasso')
  for (const item of data.byPatient) {
    lines.push(`"${item.name}",${item.sessionsCount},${item.income.toFixed(2)}`)
  }
  lines.push('')
  lines.push('PAGAMENTI')
  lines.push('Data,Paziente,Importo,Metodo,Note')
  for (const p of data.payments) {
    lines.push(
      `${p.date},"${p.patientName}",${p.amount.toFixed(2)},${p.method},"${p.notes.replace(/"/g, '""')}"`
    )
  }

  const csv = lines.join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
