import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { Database } from '@/types/database'

export type CalendarSettings = Database['public']['Tables']['calendar_settings']['Row']
type CalendarSettingsUpdate = Database['public']['Tables']['calendar_settings']['Update']

export const DEFAULT_CALENDAR_SETTINGS = {
  title_format: 'initials' as const,
  color_by_service: true,
}

export const useCalendarSettings = () => {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['calendar_settings', user?.id],
    queryFn: async (): Promise<CalendarSettings | null> => {
      if (!user) return null
      const { data, error } = await supabase
        .from('calendar_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) throw error
      return data
    },
    enabled: !!user,
  })
}

export const useUpdateCalendarSettings = () => {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (updates: CalendarSettingsUpdate) => {
      if (!user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('calendar_settings')
        .upsert(
          { user_id: user.id, ...updates },
          { onConflict: 'user_id' }
        )
        .select()
        .single()

      if (error) throw error
      return data as CalendarSettings
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar_settings'] })
    },
  })
}
