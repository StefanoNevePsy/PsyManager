import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { Database } from '@/types/database'

type Session = Database['public']['Tables']['sessions']['Row']
type SessionInsert = Database['public']['Tables']['sessions']['Insert']
type SessionUpdate = Database['public']['Tables']['sessions']['Update']
type Patient = Database['public']['Tables']['patients']['Row']
type ServiceType = Database['public']['Tables']['service_types']['Row']

export type SessionWithRelations = Session & {
  patients: Patient
  service_types: ServiceType
}

export const useSessions = (startDate?: Date, endDate?: Date) => {
  const { user } = useAuth()

  return useQuery({
    queryKey: [
      'sessions',
      user?.id,
      startDate?.toISOString(),
      endDate?.toISOString(),
    ],
    queryFn: async () => {
      if (!user) return []
      let query = supabase
        .from('sessions')
        .select('*, patients(*), service_types(*)')
        .eq('user_id', user.id)
        .order('scheduled_at', { ascending: true })

      if (startDate) {
        query = query.gte('scheduled_at', startDate.toISOString())
      }
      if (endDate) {
        query = query.lte('scheduled_at', endDate.toISOString())
      }

      const { data, error } = await query
      if (error) throw error
      return data as SessionWithRelations[]
    },
    enabled: !!user,
  })
}

export const useSession = (id: string | undefined) => {
  return useQuery({
    queryKey: ['session', id],
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await supabase
        .from('sessions')
        .select('*, patients(*), service_types(*)')
        .eq('id', id)
        .single()

      if (error) throw error
      return data as SessionWithRelations
    },
    enabled: !!id,
  })
}

export const useCreateSession = () => {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (session: Omit<SessionInsert, 'user_id'>) => {
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('sessions')
        .insert({ ...session, user_id: user.id })
        .select('*, patients(*), service_types(*)')
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
    },
  })
}

export const useUpdateSession = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string
      updates: SessionUpdate
    }) => {
      const { data, error } = await supabase
        .from('sessions')
        .update(updates)
        .eq('id', id)
        .select('*, patients(*), service_types(*)')
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      queryClient.invalidateQueries({ queryKey: ['session'] })
    },
  })
}

export const useDeleteSession = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sessions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
    },
  })
}
