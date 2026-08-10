import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { SessionWithRelations } from './useSessions'

/**
 * Mirrors public.session_billing_status (migrations/016_billing_status.sql).
 * The Supabase client has no Database generic (see CLAUDE.md), so this view
 * — which has no counterpart in src/types/database.ts — gets its own local
 * interface instead.
 */
export type BillingStatus = 'invoiced' | 'cash' | 'exempt' | 'not_due' | 'to_invoice'

export interface BillingStatusRow {
  session_id: string
  user_id: string
  scheduled_at: string
  status: string
  invoice_exempt: boolean
  receipt_id: string | null
  receipt_number: number | null
  receipt_year: number | null
  receipt_date: string | null
  paid_cash: boolean
  billing_status: BillingStatus
}

/** Stable, order-independent key so re-renders with the same id set reuse the cache. */
const idsKey = (ids: string[]) => [...ids].sort().join(',')

/**
 * Billing status for a specific set of sessions (e.g. the ones currently
 * rendered in a list), keyed by session id for O(1) lookup per row.
 */
export const useBillingStatus = (sessionIds: string[]) => {
  const { user } = useAuth()
  const key = idsKey(sessionIds)

  return useQuery({
    queryKey: ['session_billing_status', user?.id, key],
    queryFn: async (): Promise<Map<string, BillingStatusRow>> => {
      if (!user || sessionIds.length === 0) return new Map()

      const { data, error } = await supabase
        .from('session_billing_status')
        .select('*')
        .in('session_id', sessionIds)

      if (error) throw error

      const map = new Map<string, BillingStatusRow>()
      for (const row of (data ?? []) as BillingStatusRow[]) {
        map.set(row.session_id, row)
      }
      return map
    },
    enabled: !!user && sessionIds.length > 0,
  })
}

// Same joins as useSessions, so the "to invoice" list can show
// patient/group name, service and price without a second round trip.
const SESSION_SELECT = '*, patients(*), service_types(*), patient_groups(*)'

/**
 * Sessions that are billable, have ended, and still have no receipt —
 * i.e. billing_status = 'to_invoice' — within an optional date range.
 * The view itself has no patient/service names, so this fetches the
 * matching session ids from the view, then the full rows from `sessions`.
 */
export const useSessionsToInvoice = (from?: Date, to?: Date) => {
  const { user } = useAuth()

  return useQuery({
    queryKey: [
      'session_billing_status',
      'to_invoice',
      user?.id,
      from?.toISOString(),
      to?.toISOString(),
    ],
    queryFn: async (): Promise<SessionWithRelations[]> => {
      if (!user) return []

      let statusQuery = supabase
        .from('session_billing_status')
        .select('session_id')
        .eq('billing_status', 'to_invoice')

      if (from) statusQuery = statusQuery.gte('scheduled_at', from.toISOString())
      if (to) statusQuery = statusQuery.lte('scheduled_at', to.toISOString())

      const { data: statusRows, error: statusError } = await statusQuery
      if (statusError) throw statusError

      const ids = (statusRows ?? []).map((r: { session_id: string }) => r.session_id)
      if (ids.length === 0) return []

      const { data, error } = await supabase
        .from('sessions')
        .select(SESSION_SELECT)
        .in('id', ids)
        .order('scheduled_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as SessionWithRelations[]
    },
    enabled: !!user,
  })
}

/** Manual override: mark (or unmark) a session as not requiring an invoice. */
export const useSetInvoiceExempt = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, exempt }: { id: string; exempt: boolean }) => {
      const { data, error } = await supabase
        .from('sessions')
        .update({ invoice_exempt: exempt })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      queryClient.invalidateQueries({ queryKey: ['session_billing_status'] })
      queryClient.invalidateQueries({ queryKey: ['receipts'] })
    },
  })
}
