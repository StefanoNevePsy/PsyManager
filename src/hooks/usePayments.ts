import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { Database } from '@/types/database'

type Payment = Database['public']['Tables']['payments']['Row']
type PaymentInsert = Database['public']['Tables']['payments']['Insert']
type PaymentUpdate = Database['public']['Tables']['payments']['Update']
type Patient = Database['public']['Tables']['patients']['Row']
type Session = Database['public']['Tables']['sessions']['Row']

export type PaymentWithRelations = Payment & {
  patients: Patient | null
  sessions: Session | null
}

export const usePayments = () => {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['payments', user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from('payments')
        .select('*, patients(*), sessions(*)')
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
      queryClient.invalidateQueries({ queryKey: ['payments'] })
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
      queryClient.invalidateQueries({ queryKey: ['payments'] })
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
      queryClient.invalidateQueries({ queryKey: ['payments'] })
    },
  })
}

export interface PatientBalance {
  patientId: string
  patientName: string
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
        .select('*, patients(*), service_types(*)')
        .eq('user_id', user.id)
        .lte('scheduled_at', now.toISOString())

      if (sessionsError) throw sessionsError

      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', user.id)

      if (paymentsError) throw paymentsError

      const balances = new Map<string, PatientBalance>()
      const nowMs = now.getTime()

      for (const session of sessions || []) {
        if (!session.patients || !session.service_types) continue
        if (session.service_types.type !== 'private') continue

        // Only count if session has ENDED (scheduled_at + duration < now)
        const sessionStart = new Date(session.scheduled_at).getTime()
        const sessionEnd = sessionStart + (session.duration_minutes * 60 * 1000)
        if (sessionEnd > nowMs) continue

        const patientId = session.patient_id
        const existing = balances.get(patientId) || {
          patientId,
          patientName: `${session.patients.last_name} ${session.patients.first_name}`,
          totalDue: 0,
          totalPaid: 0,
          balance: 0,
          sessionsCount: 0,
        }

        existing.totalDue += Number(session.service_types.price)
        existing.sessionsCount += 1
        balances.set(patientId, existing)
      }

      for (const payment of payments || []) {
        if (!payment.patient_id) continue
        const existing = balances.get(payment.patient_id)
        if (existing) {
          existing.totalPaid += Number(payment.amount)
        }
      }

      // Also include patients who only have payments but no completed sessions —
      // their balance is a credit (negative).
      for (const payment of payments || []) {
        if (!payment.patient_id) continue
        if (!balances.has(payment.patient_id)) {
          balances.set(payment.patient_id, {
            patientId: payment.patient_id,
            patientName: '',
            totalDue: 0,
            totalPaid: Number(payment.amount),
            balance: 0,
            sessionsCount: 0,
          })
        }
      }

      const result = Array.from(balances.values()).map((b) => ({
        ...b,
        balance: b.totalDue - b.totalPaid,
      }))

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
  const { data = [] } = usePatientBalances()
  const map = new Map<string, number>()
  for (const b of data) map.set(b.patientId, b.balance)
  return map
}
