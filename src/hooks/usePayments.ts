import { useMemo } from 'react'
import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { Database } from '@/types/database'
import { patientFullName, isBillableStatus } from '@/lib/sessionDisplay'

type Payment = Database['public']['Tables']['payments']['Row']
type PaymentInsert = Database['public']['Tables']['payments']['Insert']
type PaymentUpdate = Database['public']['Tables']['payments']['Update']
type Patient = Database['public']['Tables']['patients']['Row']
type Session = Database['public']['Tables']['sessions']['Row']
type PatientGroup = Database['public']['Tables']['patient_groups']['Row']

export type PaymentWithRelations = Payment & {
  patients: Patient | null
  patient_groups: PatientGroup | null
  sessions: Session | null
}

const round2 = (n: number) => Math.round(n * 100) / 100

// Payments affect balances, dashboard KPIs and reports
const invalidatePaymentRelated = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: ['payments'] })
  queryClient.invalidateQueries({ queryKey: ['patient_balances'] })
  queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] })
  queryClient.invalidateQueries({ queryKey: ['reports'] })
}

export const usePayments = () => {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['payments', user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from('payments')
        .select('*, patients(*), patient_groups(*), sessions(*)')
        .eq('user_id', user.id)
        .order('payment_date', { ascending: false })

      if (error) throw error
      return data as PaymentWithRelations[]
    },
    enabled: !!user,
  })
}

export const usePaymentsByPatient = (patientId: string | undefined) => {
  return useQuery({
    queryKey: ['payments', 'patient', patientId],
    queryFn: async () => {
      if (!patientId) return []
      const { data, error } = await supabase
        .from('payments')
        .select('*, sessions(*)')
        .eq('patient_id', patientId)
        .order('payment_date', { ascending: false })

      if (error) throw error
      return data as Payment[]
    },
    enabled: !!patientId,
  })
}

export const useCreatePayment = () => {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (payment: Omit<PaymentInsert, 'user_id'>) => {
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('payments')
        .insert({ ...payment, user_id: user.id })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      invalidatePaymentRelated(queryClient)
    },
  })
}

export const useUpdatePayment = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: PaymentUpdate }) => {
      const { data, error } = await supabase
        .from('payments')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      invalidatePaymentRelated(queryClient)
    },
  })
}

export const useDeletePayment = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('payments').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      invalidatePaymentRelated(queryClient)
    },
  })
}

export interface PatientBalance {
  /** Patient uuid for individual entries, group uuid for group entries */
  patientId: string
  patientName: string
  entityType: 'patient' | 'group'
  totalDue: number
  totalPaid: number
  balance: number
  sessionsCount: number
}

export const usePatientBalances = () => {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['patient_balances', user?.id],
    queryFn: async () => {
      if (!user) return []

      const now = new Date()
      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select('*, patients(*), patient_groups(*), service_types(*)')
        .eq('user_id', user.id)
        .lte('scheduled_at', now.toISOString())

      if (sessionsError) throw sessionsError

      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('*, patients(*), patient_groups(*)')
        .eq('user_id', user.id)

      if (paymentsError) throw paymentsError

      const balances = new Map<string, PatientBalance>()
      const nowMs = now.getTime()

      const getEntry = (
        entityId: string,
        entityType: 'patient' | 'group',
        name: string
      ): PatientBalance => {
        let entry = balances.get(entityId)
        if (!entry) {
          entry = {
            patientId: entityId,
            patientName: name,
            entityType,
            totalDue: 0,
            totalPaid: 0,
            balance: 0,
            sessionsCount: 0,
          }
          balances.set(entityId, entry)
        } else if (!entry.patientName && name) {
          entry.patientName = name
        }
        return entry
      }

      for (const session of sessions || []) {
        if (!session.service_types) continue
        if (session.service_types.type !== 'private') continue
        // Cancelled / no-show sessions are not billed
        if (!isBillableStatus(session.status)) continue

        // Only count if session has ENDED (scheduled_at + duration < now)
        const sessionStart = new Date(session.scheduled_at).getTime()
        const sessionEnd = sessionStart + (session.duration_minutes * 60 * 1000)
        if (sessionEnd > nowMs) continue

        // Individual sessions bill the patient; couple/family sessions bill the group
        const entityId = session.patient_id ?? session.group_id
        if (!entityId) continue
        const entry = session.patient_id
          ? getEntry(entityId, 'patient', patientFullName(session.patients))
          : getEntry(entityId, 'group', session.patient_groups?.name || 'Gruppo')

        entry.totalDue += Number(session.service_types.price)
        entry.sessionsCount += 1
      }

      for (const payment of payments || []) {
        const entityId = payment.patient_id ?? payment.group_id
        if (!entityId) continue
        const entry = payment.patient_id
          ? getEntry(entityId, 'patient', patientFullName(payment.patients))
          : getEntry(entityId, 'group', payment.patient_groups?.name || 'Gruppo')
        entry.totalPaid += Number(payment.amount)
      }

      const result = Array.from(balances.values()).map((b) => {
        const totalDue = round2(b.totalDue)
        const totalPaid = round2(b.totalPaid)
        let balance = round2(totalDue - totalPaid)
        // Squash floating-point dust so settled entries show as exactly 0
        if (Math.abs(balance) < 0.005) balance = 0
        return { ...b, totalDue, totalPaid, balance }
      })

      return result.sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
    },
    enabled: !!user,
  })
}

/**
 * Returns a Map<patientId, balance> for fast lookup. Positive = patient owes money,
 * negative = credit. Use this from session views to show colored balance indicators.
 */
export const usePatientBalanceMap = () => {
  const { data } = usePatientBalances()
  return useMemo(() => {
    const map = new Map<string, number>()
    for (const b of data ?? []) map.set(b.patientId, b.balance)
    return map
  }, [data])
}
