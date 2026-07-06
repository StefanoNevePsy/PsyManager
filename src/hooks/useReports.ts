import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { useTaxSettings } from './useTaxSettings'
import {
  startOfMonth,
  format,
  eachMonthOfInterval,
  subMonths,
} from 'date-fns'
import { patientFullName, sessionDisplayName, isBillableStatus } from '@/lib/sessionDisplay'
import { computeNet, computeSessionNet, DEFAULT_TAX_SETTINGS, TaxParams } from '@/lib/netIncome'

export interface ReportData {
  totalIncome: number
  totalSessions: number
  /** Estimated net after center share + taxes/ENPAP, summed over payments */
  totalNetIncome: number
  totalCenterShare: number
  totalTaxes: number
  byServiceType: Array<{
    name: string
    type: 'private' | 'package'
    count: number
    income: number
    /** Estimated net, based on the service type's default payment method */
    netIncome: number
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
    net: number
  }>
  payments: Array<{
    date: string
    amount: number
    patientName: string
    method: string
    notes: string
    net: number
    centerShare: number
    taxes: number
  }>
}

/**
 * Center share (0-100) of the service type linked to a payment via its session, if any.
 * Defensive about shape: depending on the select string, supabase-js may type (or
 * return) the embedded relation as a single object or as an array.
 */
const centerPctOfPayment = (p: any): number => {
  const session = Array.isArray(p?.sessions) ? p.sessions[0] : p?.sessions
  const serviceType = Array.isArray(session?.service_types)
    ? session.service_types[0]
    : session?.service_types
  return serviceType?.center_percentage ?? 0
}

export const useReports = (startDate: Date, endDate: Date) => {
  const { user } = useAuth()
  const { data: taxSettingsRow } = useTaxSettings()

  const taxParams: TaxParams = {
    coefficiente_redditivita:
      taxSettingsRow?.coefficiente_redditivita ?? DEFAULT_TAX_SETTINGS.coefficiente_redditivita,
    imposta_sostitutiva_pct:
      taxSettingsRow?.imposta_sostitutiva_pct ?? DEFAULT_TAX_SETTINGS.imposta_sostitutiva_pct,
    enpap_pct: taxSettingsRow?.enpap_pct ?? DEFAULT_TAX_SETTINGS.enpap_pct,
  }

  return useQuery({
    queryKey: [
      'reports',
      user?.id,
      startDate.toISOString(),
      endDate.toISOString(),
      taxParams.coefficiente_redditivita,
      taxParams.imposta_sostitutiva_pct,
      taxParams.enpap_pct,
    ],
    queryFn: async (): Promise<ReportData> => {
      if (!user) {
        return {
          totalIncome: 0,
          totalSessions: 0,
          totalNetIncome: 0,
          totalCenterShare: 0,
          totalTaxes: 0,
          byServiceType: [],
          byPatient: [],
          monthlyTrend: [],
          payments: [],
        }
      }

      // Local-calendar date strings: toISOString() would roll local midnight
      // back into the previous day for UTC+ timezones (Italy)
      const startStr = format(startDate, 'yyyy-MM-dd')
      const endStr = format(endDate, 'yyyy-MM-dd')

      const [
        { data: payments },
        { data: sessions },
      ] = await Promise.all([
        supabase
          .from('payments')
          .select('*, patients(*), patient_groups(*), sessions(*, service_types(*))')
          .eq('user_id', user.id)
          .gte('payment_date', startStr)
          .lte('payment_date', endStr),
        supabase
          .from('sessions')
          .select('*, patients(*), patient_groups(*), service_types(*)')
          .eq('user_id', user.id)
          .gte('scheduled_at', startDate.toISOString())
          .lte('scheduled_at', endDate.toISOString()),
      ])

      const totalIncome =
        payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0
      const totalSessions = sessions?.length || 0

      // Net breakdown per payment (center share + estimated taxes/ENPAP)
      const paymentNets = (payments || []).map((p) =>
        computeNet(Number(p.amount), p.payment_method, centerPctOfPayment(p), taxParams)
      )
      const totalNetIncome = paymentNets.reduce((sum, n) => sum + n.net, 0)
      const totalCenterShare = paymentNets.reduce((sum, n) => sum + n.centerShare, 0)
      const totalTaxes = paymentNets.reduce((sum, n) => sum + n.taxes, 0)

      // By service type
      const serviceTypeMap = new Map<
        string,
        {
          name: string
          type: 'private' | 'package'
          count: number
          income: number
          netIncome: number
        }
      >()

      for (const session of sessions || []) {
        if (!session.service_types) continue
        if (!isBillableStatus(session.status)) continue
        const key = session.service_type_id
        const existing = serviceTypeMap.get(key) || {
          name: session.service_types.name,
          type: session.service_types.type,
          count: 0,
          income: 0,
          netIncome: 0,
        }
        existing.count += 1
        if (session.service_types.type === 'private') {
          existing.income += Number(session.service_types.price)
          existing.netIncome += computeSessionNet(
            Number(session.service_types.price),
            session.service_types,
            taxParams
          ).net
        }
        serviceTypeMap.set(key, existing)
      }

      // By patient
      const patientMap = new Map<
        string,
        { name: string; sessionsCount: number; income: number }
      >()

      for (const session of sessions || []) {
        if (!isBillableStatus(session.status)) continue
        const key = session.patient_id ?? session.group_id
        if (!key) continue
        const existing = patientMap.get(key) || {
          name: sessionDisplayName(session),
          sessionsCount: 0,
          income: 0,
        }
        existing.sessionsCount += 1
        if (session.service_types?.type === 'private') {
          existing.income += Number(session.service_types.price)
        }
        patientMap.set(key, existing)
      }

      // Entities (patients or groups) that only have payments in the period —
      // no sessions — must still appear in the per-patient report.
      for (const payment of payments || []) {
        const key = payment.patient_id ?? payment.group_id
        if (!key || patientMap.has(key)) continue
        patientMap.set(key, {
          name: payment.patient_id
            ? patientFullName(payment.patients) || '-'
            : payment.patient_groups?.name || 'Gruppo',
          sessionsCount: 0,
          income: 0,
        })
      }

      // Monthly trend (last 6 months)
      const trendStart = subMonths(startOfMonth(new Date()), 5)
      const months = eachMonthOfInterval({
        start: trendStart,
        end: new Date(),
      })

      const { data: trendPayments } = await supabase
        .from('payments')
        .select('amount, payment_date, payment_method, sessions(service_types(center_percentage))')
        .eq('user_id', user.id)
        .gte('payment_date', format(trendStart, 'yyyy-MM-dd'))

      const { data: trendSessions } = await supabase
        .from('sessions')
        .select('scheduled_at')
        .eq('user_id', user.id)
        .gte('scheduled_at', trendStart.toISOString())

      const monthlyTrend = months.map((month) => {
        const monthKey = format(month, 'yyyy-MM')
        const monthPaymentsInMonth =
          trendPayments?.filter((p) => p.payment_date.startsWith(monthKey)) || []
        const monthIncome = monthPaymentsInMonth.reduce((sum, p) => sum + Number(p.amount), 0)
        const monthNet = monthPaymentsInMonth.reduce(
          (sum, p) =>
            sum +
            computeNet(Number(p.amount), p.payment_method, centerPctOfPayment(p), taxParams).net,
          0
        )
        const monthSessionsCount =
          trendSessions?.filter((s) =>
            s.scheduled_at.startsWith(monthKey)
          ).length || 0

        return {
          month: format(month, 'MMM yyyy'),
          income: monthIncome,
          sessions: monthSessionsCount,
          net: monthNet,
        }
      })

      // Payments list
      const paymentsList = (payments || []).map((p) => {
        const net = computeNet(Number(p.amount), p.payment_method, centerPctOfPayment(p), taxParams)
        return {
          date: p.payment_date,
          amount: Number(p.amount),
          patientName: p.group_id
            ? p.patient_groups?.name || 'Gruppo'
            : patientFullName(p.patients) || '-',
          method: p.payment_method,
          notes: p.notes || '',
          net: net.net,
          centerShare: net.centerShare,
          taxes: net.taxes,
        }
      })

      return {
        totalIncome,
        totalSessions,
        totalNetIncome,
        totalCenterShare,
        totalTaxes,
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

/** Quote a CSV field and escape internal quotes. */
const csvEscape = (value: string) => `"${String(value).replace(/"/g, '""')}"`

export const exportToCSV = (data: ReportData, filename: string) => {
  const lines: string[] = []

  lines.push('REPORT PSYMANAGER')
  lines.push('')
  lines.push(`Totale Incassato,${data.totalIncome.toFixed(2)}`)
  lines.push(`Totale Sedute,${data.totalSessions}`)
  lines.push(`Netto Stimato,${data.totalNetIncome.toFixed(2)}`)
  lines.push(`Quota Centri,${data.totalCenterShare.toFixed(2)}`)
  lines.push(`Tasse+ENPAP Stimate,${data.totalTaxes.toFixed(2)}`)
  lines.push('')
  lines.push('GUADAGNI PER TIPO DI PRESTAZIONE')
  lines.push('Nome,Tipo,Sedute,Incasso,Netto')
  for (const item of data.byServiceType) {
    lines.push(
      `${csvEscape(item.name)},${csvEscape(item.type === 'private' ? 'Privato' : 'Pacchetto')},${item.count},${item.income.toFixed(2)},${item.netIncome.toFixed(2)}`
    )
  }
  lines.push('')
  lines.push('GUADAGNI PER PAZIENTE')
  lines.push('Paziente,Sedute,Incasso')
  for (const item of data.byPatient) {
    lines.push(`${csvEscape(item.name)},${item.sessionsCount},${item.income.toFixed(2)}`)
  }
  lines.push('')
  lines.push('PAGAMENTI')
  lines.push('Data,Paziente,Importo,Metodo,Netto,Quota centro,Tasse,Note')
  for (const p of data.payments) {
    lines.push(
      `${p.date},${csvEscape(p.patientName)},${p.amount.toFixed(2)},${p.method},${p.net.toFixed(2)},${p.centerShare.toFixed(2)},${p.taxes.toFixed(2)},${csvEscape(p.notes)}`
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
