import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { Database } from '@/types/database'

type Patient = Database['public']['Tables']['patients']['Row']
type PatientTag = Database['public']['Tables']['patient_tags']['Row']
type PatientContact = Database['public']['Tables']['patient_contacts']['Row']
type PatientInsert = Database['public']['Tables']['patients']['Insert']
type PatientUpdate = Database['public']['Tables']['patients']['Update']

export interface PatientWithTags extends Patient {
  patient_tags?: PatientTag[]
  patient_contacts?: PatientContact[]
}

/**
 * Fetch patients with tags and contacts joined CLIENT-SIDE.
 *
 * Why not a single nested PostgREST query? We tried `select('*, patient_tag_assignments(patient_tags(*)), patient_contacts(*)')`
 * but it fails entirely if any of the joined relations have a missing FK in the
 * PostgREST schema cache or any RLS edge case — and one bad join takes down the
 * whole patient list. With separate queries, a failure in tags/contacts only
 * makes those fields empty; the patient list still loads.
 */
export const usePatients = () => {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['patients', user?.id],
    queryFn: async (): Promise<PatientWithTags[]> => {
      if (!user) return []

      // Always-required base query
      const { data: patients, error } = await supabase
        .from('patients')
        .select('*')
        .eq('user_id', user.id)
        .order('last_name', { ascending: true })

      if (error) throw error
      if (!patients || patients.length === 0) return []

      const patientIds = patients.map((p: any) => p.id)

      // Side queries — failures are non-fatal (we just lose the extras).
      const [contactsRes, assignmentsRes, tagsRes] = await Promise.all([
        supabase
          .from('patient_contacts')
          .select('*')
          .in('patient_id', patientIds),
        supabase
          .from('patient_tag_assignments')
          .select('patient_id, tag_id')
          .in('patient_id', patientIds),
        supabase
          .from('patient_tags')
          .select('*')
          .eq('user_id', user.id),
      ])

      const contactsByPatient = new Map<string, PatientContact[]>()
      ;(contactsRes.data || []).forEach((c: any) => {
        const list = contactsByPatient.get(c.patient_id) || []
        list.push(c)
        contactsByPatient.set(c.patient_id, list)
      })

      const tagsById = new Map<string, PatientTag>()
      ;(tagsRes.data || []).forEach((t: any) => tagsById.set(t.id, t))

      const tagsByPatient = new Map<string, PatientTag[]>()
      ;(assignmentsRes.data || []).forEach((a: any) => {
        const tag = tagsById.get(a.tag_id)
        if (!tag) return
        const list = tagsByPatient.get(a.patient_id) || []
        list.push(tag)
        tagsByPatient.set(a.patient_id, list)
      })

      return (patients as Patient[]).map((p) => ({
        ...p,
        patient_contacts: contactsByPatient.get(p.id) || [],
        patient_tags: tagsByPatient.get(p.id) || [],
      }))
    },
    enabled: !!user,
  })
}

export const usePatient = (id: string | undefined) => {
  return useQuery({
    queryKey: ['patient', id],
    queryFn: async (): Promise<PatientWithTags | null> => {
      if (!id) return null

      const { data: patient, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      if (!patient) return null

      const [contactsRes, assignmentsRes] = await Promise.all([
        supabase.from('patient_contacts').select('*').eq('patient_id', id),
        supabase.from('patient_tag_assignments').select('tag_id').eq('patient_id', id),
      ])

      const tagIds = (assignmentsRes.data || []).map((a: any) => a.tag_id)
      let tags: PatientTag[] = []
      if (tagIds.length > 0) {
        const { data: tagsData } = await supabase
          .from('patient_tags')
          .select('*')
          .in('id', tagIds)
        tags = (tagsData || []) as PatientTag[]
      }

      return {
        ...(patient as Patient),
        patient_contacts: (contactsRes.data || []) as PatientContact[],
        patient_tags: tags,
      }
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
