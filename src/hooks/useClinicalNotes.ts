import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { Database } from '@/types/database'

type ClinicalNote = Database['public']['Tables']['clinical_notes']['Row']
type ClinicalNoteInsert = Database['public']['Tables']['clinical_notes']['Insert']
type ClinicalNoteUpdate = Database['public']['Tables']['clinical_notes']['Update']
type Patient = Database['public']['Tables']['patients']['Row']
type Session = Database['public']['Tables']['sessions']['Row']

export type ClinicalNoteWithRelations = ClinicalNote & {
  patients: Pick<Patient, 'id' | 'first_name' | 'last_name'> | null
  sessions: Pick<Session, 'id' | 'scheduled_at'> | null
}

export const useClinicalNotes = (patientId?: string) => {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['clinical_notes', user?.id, patientId],
    queryFn: async () => {
      if (!user) return []

      let query = supabase
        .from('clinical_notes')
        .select('*, patients(id, first_name, last_name), sessions(id, scheduled_at)')
        .eq('user_id', user.id)
        .order('note_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (patientId) {
        query = query.eq('patient_id', patientId)
      }

      const { data, error } = await query
      if (error) throw error
      return data as ClinicalNoteWithRelations[]
    },
    enabled: !!user,
  })
}

export const useCreateClinicalNote = () => {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (note: Omit<ClinicalNoteInsert, 'user_id'>) => {
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('clinical_notes')
        .insert({ ...note, user_id: user.id })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinical_notes'] })
    },
  })
}

export const useUpdateClinicalNote = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: ClinicalNoteUpdate }) => {
      const { data, error } = await supabase
        .from('clinical_notes')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinical_notes'] })
    },
  })
}

export const useDeleteClinicalNote = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('clinical_notes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinical_notes'] })
    },
  })
}
