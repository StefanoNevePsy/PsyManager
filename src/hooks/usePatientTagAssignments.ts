import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database'

type PatientTag = Database['public']['Tables']['patient_tags']['Row']
type TagAssignment = Database['public']['Tables']['patient_tag_assignments']['Row']

export interface PatientTagWithAssignment extends PatientTag {
  isAssigned?: boolean
}

export const usePatientTagAssignments = (patientId: string | undefined) => {
  const queryClient = useQueryClient()

  const { data: assignedTagIds = [] } = useQuery({
    queryKey: ['patientTagAssignments', patientId],
    queryFn: async () => {
      if (!patientId) return []
      const { data, error } = await supabase
        .from('patient_tag_assignments')
        .select('tag_id')
        .eq('patient_id', patientId)

      if (error) throw error
      return (data as TagAssignment[]).map((a) => a.tag_id)
    },
    enabled: !!patientId,
  })

  const assignMutation = useMutation({
    mutationFn: async (tagId: string) => {
      if (!patientId) throw new Error('Patient not specified')
      const { error } = await supabase
        .from('patient_tag_assignments')
        .insert({
          patient_id: patientId,
          tag_id: tagId,
        })

      if (error && !error.message.includes('duplicate')) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patientTagAssignments', patientId] })
      queryClient.invalidateQueries({ queryKey: ['patients'] })
    },
  })

  const unassignMutation = useMutation({
    mutationFn: async (tagId: string) => {
      if (!patientId) throw new Error('Patient not specified')
      const { error } = await supabase
        .from('patient_tag_assignments')
        .delete()
        .eq('patient_id', patientId)
        .eq('tag_id', tagId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patientTagAssignments', patientId] })
      queryClient.invalidateQueries({ queryKey: ['patients'] })
    },
  })

  const toggleTag = async (tagId: string) => {
    if (assignedTagIds.includes(tagId)) {
      await unassignMutation.mutateAsync(tagId)
    } else {
      await assignMutation.mutateAsync(tagId)
    }
  }

  return {
    assignedTagIds,
    assignTag: assignMutation.mutateAsync,
    unassignTag: unassignMutation.mutateAsync,
    toggleTag,
    isLoading: assignMutation.isPending || unassignMutation.isPending,
  }
}
