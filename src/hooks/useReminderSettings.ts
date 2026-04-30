import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { Database } from '@/types/database'

export type ReminderSettings =
  Database['public']['Tables']['reminder_settings']['Row']

export const DEFAULT_REMINDER_SETTINGS = {
  pre_session_enabled: true,
  pre_session_minutes: 30,
  post_session_enabled: false,
  post_session_minutes: 30,
}

export const useReminderSettings = () => {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['reminder_settings', user?.id],
    queryFn: async (): Promise<ReminderSettings | null> => {
      if (!user) return null
      const { data, error } = await supabase
        .from('reminder_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) throw error
      return (data as ReminderSettings | null) ?? null
    },
    enabled: !!user,
  })
}

export const useUpsertReminderSettings = () => {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (
      updates: Partial<Omit<ReminderSettings, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
    ) => {
      if (!user) throw new Error('Not authenticated')

      // Upsert by user_id (unique constraint)
      const { data, error } = await supabase
        .from('reminder_settings')
        .upsert(
          { user_id: user.id, ...updates },
          { onConflict: 'user_id' }
        )
        .select()
        .single()

      if (error) throw error
      return data as ReminderSettings
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminder_settings'] })
    },
  })
}
