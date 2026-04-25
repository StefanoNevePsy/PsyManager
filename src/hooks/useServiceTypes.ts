import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { Database } from '@/types/database'

type ServiceType = Database['public']['Tables']['service_types']['Row']
type ServiceTypeInsert = Database['public']['Tables']['service_types']['Insert']
type ServiceTypeUpdate = Database['public']['Tables']['service_types']['Update']

export const useServiceTypes = () => {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['service_types', user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from('service_types')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true })

      if (error) throw error
      return data as ServiceType[]
    },
    enabled: !!user,
  })
}

export const useCreateServiceType = () => {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (serviceType: Omit<ServiceTypeInsert, 'user_id'>) => {
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('service_types')
        .insert({ ...serviceType, user_id: user.id })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service_types'] })
    },
  })
}

export const useUpdateServiceType = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string
      updates: ServiceTypeUpdate
    }) => {
      const { data, error } = await supabase
        .from('service_types')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service_types'] })
    },
  })
}

export const useDeleteServiceType = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('service_types').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service_types'] })
    },
  })
}
