import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { Database } from '@/types/database'

type Receipt = Database['public']['Tables']['receipts']['Row']
type ReceiptInsert = Database['public']['Tables']['receipts']['Insert']
type ReceiptUpdate = Database['public']['Tables']['receipts']['Update']
type ReceiptSettings = Database['public']['Tables']['receipt_settings']['Row']
type ReceiptSettingsUpdate = Database['public']['Tables']['receipt_settings']['Update']
type Patient = Database['public']['Tables']['patients']['Row']
type PatientGroup = Database['public']['Tables']['patient_groups']['Row']

export type ReceiptWithRelations = Receipt & {
  patients: Patient | null
  patient_groups: PatientGroup | null
  receipt_sessions: { session_id: string }[]
}

const RECEIPT_SELECT = '*, patients(*), patient_groups(*), receipt_sessions(session_id)'

/** Postgres error code for a UNIQUE constraint violation. */
const UNIQUE_VIOLATION = '23505'

export const useReceipts = () => {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['receipts', user?.id],
    queryFn: async (): Promise<ReceiptWithRelations[]> => {
      if (!user) return []
      const { data, error } = await supabase
        .from('receipts')
        .select(RECEIPT_SELECT)
        .eq('user_id', user.id)
        .order('year', { ascending: false })
        .order('number', { ascending: false })

      if (error) throw error
      return data as unknown as ReceiptWithRelations[]
    },
    enabled: !!user,
  })
}

export const useReceiptSettings = () => {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['receipt_settings', user?.id],
    queryFn: async (): Promise<ReceiptSettings | null> => {
      if (!user) return null
      const { data, error } = await supabase
        .from('receipt_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) throw error
      return data
    },
    enabled: !!user,
  })
}

export const useUpdateReceiptSettings = () => {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (updates: ReceiptSettingsUpdate) => {
      if (!user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('receipt_settings')
        .upsert({ user_id: user.id, ...updates }, { onConflict: 'user_id' })
        .select()
        .single()

      if (error) throw error
      return data as ReceiptSettings
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipt_settings'] })
    },
  })
}

/**
 * Suggests the next receipt number for a given year: max(number) + 1 among
 * the user's receipts for that year, or 1 if none exist yet. This is only a
 * SUGGESTION shown in the form — the real guard against collisions is the
 * UNIQUE(user_id, year, number) constraint + the retry in useCreateReceipt.
 */
export const useNextReceiptNumber = (year: number | undefined) => {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['receipts', 'next_number', user?.id, year],
    queryFn: async (): Promise<number> => {
      if (!user || !year) return 1
      const { data, error } = await supabase
        .from('receipts')
        .select('number')
        .eq('user_id', user.id)
        .eq('year', year)
        .order('number', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error
      return data ? data.number + 1 : 1
    },
    enabled: !!user && !!year,
  })
}

/**
 * All session ids already covered by an existing receipt (for the current
 * user), so the form's session picker can hide sessions that were already
 * billed on a previous receipt.
 */
export const useBilledSessionIds = () => {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['receipts', 'billed_session_ids', user?.id],
    queryFn: async (): Promise<Set<string>> => {
      if (!user) return new Set()
      const { data, error } = await supabase
        .from('receipt_sessions')
        .select('session_id, receipts!inner(user_id)')
        .eq('receipts.user_id', user.id)

      if (error) throw error
      return new Set((data || []).map((r: { session_id: string }) => r.session_id))
    },
    enabled: !!user,
  })
}

export const useCreateReceipt = () => {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({
      receipt,
      sessionIds = [],
    }: {
      receipt: Omit<ReceiptInsert, 'user_id'>
      sessionIds?: string[]
    }) => {
      if (!user) throw new Error('Not authenticated')

      const insertReceipt = (candidate: Omit<ReceiptInsert, 'user_id'>) =>
        supabase
          .from('receipts')
          .insert({ ...candidate, user_id: user.id })
          .select()
          .single()

      let { data, error } = await insertReceipt(receipt)

      // Two receipts issued in quick succession (or a stale "next number"
      // suggestion still shown in an open form) can collide on
      // UNIQUE(user_id, year, number). Retry once with number+1 instead of
      // surfacing a raw database error to the user.
      if (error && error.code === UNIQUE_VIOLATION) {
        const retry = await insertReceipt({ ...receipt, number: receipt.number + 1 })
        data = retry.data
        error = retry.error
      }

      if (error) throw error
      if (!data) throw new Error('Receipt creation failed')

      if (sessionIds.length > 0) {
        const { error: linkError } = await supabase
          .from('receipt_sessions')
          .insert(sessionIds.map((session_id) => ({ receipt_id: data.id, session_id })))
        if (linkError) throw linkError
      }

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
    },
  })
}

export const useUpdateReceipt = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      updates,
      sessionIds,
    }: {
      id: string
      updates: ReceiptUpdate
      /** When provided, replaces the full set of sessions linked to this receipt. */
      sessionIds?: string[]
    }) => {
      const { data, error } = await supabase
        .from('receipts')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      if (sessionIds) {
        const { error: deleteError } = await supabase
          .from('receipt_sessions')
          .delete()
          .eq('receipt_id', id)
        if (deleteError) throw deleteError

        if (sessionIds.length > 0) {
          const { error: linkError } = await supabase
            .from('receipt_sessions')
            .insert(sessionIds.map((session_id) => ({ receipt_id: id, session_id })))
          if (linkError) throw linkError
        }
      }

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
    },
  })
}

export const useDeleteReceipt = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('receipts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
    },
  })
}
