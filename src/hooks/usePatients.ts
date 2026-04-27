import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { Database } from '@/types/database'

type Patient = Database['public']['Tables']['patients']['Row']
type PatientTag = Database['public']['Tables']['patient_tags']['Row']
type PatientInsert = Database['public']['Tables']['patients']['Insert']
type PatientUpdate = Database['public']['Tables']['patients']['Update']

export interface PatientWithTags extends Patient {
  patient_tags?: PatientTag[]
}

export const usePatients = () => {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['patients', user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from('patients')
        .select(
          `
          *,
          patient_tag_assignments(
            patient_tags(id, user_id, name, color, icon, created_at, updated_at)
          )
        `
        )
        .eq('user_id', user.id)
        .order('last_name', { ascending: true })

      if (error) throw error

      // Transform the nested structure
      const patients = (data as any[]).map((p) => ({
        ...p,
        patient_tags: p.patient_tag_assignments
          ?.map((a: any) => a.patient_tags)
          .filter((t: any) => t !== null) || [],
      }))

      return patients as PatientWithTags[]
    },
    enabled: !!user,
  })
}

export const usePatient = (id: string | undefined) => {
  return useQuery({
    queryKey: ['patient', id],
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await supabase
        .from('patients')
        .select(
          `
          *,
          patient_tag_assignments(
            patient_tags(id, user_id, name, color, icon, created_at, updated_at)
          )
        `
        )
        .eq('id', id)
        .single()

      if (error) throw error

      const patient = data as any
      return {
        ...patient,
        patient_tags: patient.patient_tag_assignments
          ?.map((a: any) => a.patient_tags)
          .filter((t: any) => t !== null) || [],
      } as PatientWithTags
    },
    enabled: !!id,
  })
}

export const useCreatePatient = () => {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (patient: Omit<PatientInsert, 'user_id'>) => {
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('patients')
        .insert({ ...patient, user_id: user.id })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
    },
  })
}

export const useUpdatePatient = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: PatientUpdate }) => {
      const { data, error } = await supabase
        .from('patients')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      queryClient.invalidateQueries({ queryKey: ['patient'] })
    },
  })
}

export const useDeletePatient = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('patients').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] })
    },
  })
}
