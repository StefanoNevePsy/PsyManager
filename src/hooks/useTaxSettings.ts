import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { Database } from '@/types/database'

export type TaxSettings = Database['public']['Tables']['tax_settings']['Row']
type TaxSettingsUpdate = Database['public']['Tables']['tax_settings']['Update']

export const useTaxSettings = () => {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['tax_settings', user?.id],
    queryFn: async (): Promise<TaxSettings | null> => {
      if (!user) return null
      const { data, error } = await supabase
        .from('tax_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) throw error
      return data
    },
    enabled: !!user,
  })
}

export const useUpdateTaxSettings = () => {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (updates: TaxSettingsUpdate) => {
      if (!user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('tax_settings')
        .upsert({ user_id: user.id, ...updates }, { onConflict: 'user_id' })
        .select()
        .single()

      if (error) throw error
      return data as TaxSettings
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax_settings'] })
      // Net projections depend on these parameters
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard_stats'] })
    },
  })
}
