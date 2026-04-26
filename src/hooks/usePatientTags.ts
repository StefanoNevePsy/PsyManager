import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { PatientTagFormData } from '@/lib/schemas'
import { Database } from '@/types/database'

type PatientTag = Database['public']['Tables']['patient_tags']['Row']

export const usePatientTags = () => {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data = [], isLoading } = useQuery({
    queryKey: ['patientTags', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      const { data, error } = await supabase
        .from('patient_tags')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as PatientTag[]
    },
    enabled: !!user?.id,
  })

  const createMutation = useMutation({
    mutationFn: async (input: PatientTagFormData) => {
      if (!user?.id) throw new Error('User not authenticated')
      const { data, error } = await supabase
        .from('patient_tags')
        .insert({
          user_id: user.id,
          ...input,
        })
        .select()
        .single()

      if (error) throw error
      return data as PatientTag
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patientTags', user?.id] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<PatientTagFormData> }) => {
      if (!user?.id) throw new Error('User not authenticated')
      const { data, error } = await supabase
        .from('patient_tags')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw error
      return data as PatientTag
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patientTags', user?.id] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error('User not authenticated')
      const { error } = await supabase
        .from('patient_tags')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patientTags', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['patientTagAssignments'] })
    },
  })

  return {
    tags: data,
    isLoading,
    createTag: createMutation.mutateAsync,
    updateTag: updateMutation.mutateAsync,
    deleteTag: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  }
}
