import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { Database } from '@/types/database'

type PatientGroup = Database['public']['Tables']['patient_groups']['Row']
type PatientGroupInsert = Database['public']['Tables']['patient_groups']['Insert']
type PatientGroupUpdate = Database['public']['Tables']['patient_groups']['Update']
type Patient = Database['public']['Tables']['patients']['Row']

export type PatientGroupWithMembers = PatientGroup & {
  members: Patient[]
}

export const usePatientGroups = () => {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['patient_groups', user?.id],
    queryFn: async () => {
      if (!user) return []

      const { data: groups, error: gErr } = await supabase
        .from('patient_groups')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true })

      if (gErr) throw gErr

      const { data: patients, error: pErr } = await supabase
        .from('patients')
        .select('*')
        .eq('user_id', user.id)
        .not('group_id', 'is', null)

      if (pErr) throw pErr

      const groupsWithMembers: PatientGroupWithMembers[] = (groups || []).map((g) => ({
        ...g,
        members: (patients || []).filter((p) => p.group_id === g.id),
      }))

      return groupsWithMembers
    },
    enabled: !!user,
  })
}

export const useCreatePatientGroup = () => {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (group: Omit<PatientGroupInsert, 'user_id'>) => {
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('patient_groups')
        .insert({ ...group, user_id: user.id })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient_groups'] })
      queryClient.invalidateQueries({ queryKey: ['patients'] })
    },
  })
}

export const useUpdatePatientGroup = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: PatientGroupUpdate }) => {
      const { data, error } = await supabase
        .from('patient_groups')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient_groups'] })
    },
  })
}

export const useDeletePatientGroup = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('patient_groups').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient_groups'] })
      queryClient.invalidateQueries({ queryKey: ['patients'] })
    },
  })
}
