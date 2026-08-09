import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { Database } from '@/types/database'

export type ReminderDelivery = Database['public']['Tables']['reminder_deliveries']['Row']

/**
 * Fetch the SMS delivery ledger rows for a set of sessions, keyed by
 * session id, so the Reminders page can render a status badge per row
 * without issuing one query per session.
 *
 * Deliveries are created and updated server-side by the sending Edge
 * Function — this hook only reads the ledger.
 */
export const useReminderDeliveries = (sessionIds: string[]) => {
  const { user } = useAuth()
  // Sort so the query key (and cache entry) is stable regardless of the
  // order sessions happen to be in.
  const ids = [...sessionIds].sort()

  return useQuery({
    queryKey: ['reminder_deliveries', user?.id, ids],
    queryFn: async (): Promise<Map<string, ReminderDelivery>> => {
      if (!user || ids.length === 0) return new Map()

      const { data, error } = await supabase
        .from('reminder_deliveries')
        .select('*')
        .eq('channel', 'sms')
        .in('session_id', ids)

      if (error) throw error

      const map = new Map<string, ReminderDelivery>()
      for (const row of (data as ReminderDelivery[]) ?? []) {
        map.set(row.session_id, row)
      }
      return map
    },
    enabled: !!user && ids.length > 0,
  })
}
