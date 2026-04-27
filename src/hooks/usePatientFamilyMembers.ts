import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database'

type FamilyMember = Database['public']['Tables']['patient_family_members']['Row']
type FamilyMemberInsert = Database['public']['Tables']['patient_family_members']['Insert']

export const usePatientFamilyMembers = (patientId: string | undefined) => {
  return useQuery({
    queryKey: ['patientFamilyMembers', patientId],
    queryFn: async () => {
      if (!patientId) return []
      const { data, error } = await supabase
        .from('patient_family_members')
        .select('*')
        .eq('patient_id', patientId)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as FamilyMember[]
    },
    enabled: !!patientId,
  })
}

/**
 * Replace all family members for a patient with a new set.
 * Diff-based: deletes removed, updates existing (by id), inserts new.
 */
export const useReplaceFamilyMembers = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      patientId,
      members,
    }: {
      patientId: string
      members: Array<{
        id?: string
        relationship: string
        full_name?: string
        age?: number | null
        alive: boolean
        relationship_quality?: string | null
        notes?: string | null
      }>
    }) => {
      const { data: existing, error: fetchError } = await supabase
        .from('patient_family_members')
        .select('id')
        .eq('patient_id', patientId)
      if (fetchError) throw fetchError

      const newIds = new Set(members.map((m) => m.id).filter(Boolean) as string[])
      const toDelete = (existing as { id: string }[])
        .filter((e) => !newIds.has(e.id))
        .map((e) => e.id)

      if (toDelete.length > 0) {
        const { error } = await supabase
          .from('patient_family_members')
          .delete()
          .in('id', toDelete)
        if (error) throw error
      }

      const toUpdate = members.filter((m) => m.id)
      const toInsert = members.filter((m) => !m.id)

      for (const [idx, m] of toUpdate.entries()) {
        const { error } = await supabase
          .from('patient_family_members')
          .update({
            relationship: m.relationship,
            full_name: m.full_name || '',
            age: m.age ?? null,
            alive: m.alive,
            relationship_quality: m.relationship_quality || null,
            notes: m.notes || null,
            display_order: idx,
          })
          .eq('id', m.id!)
        if (error) throw error
      }

      if (toInsert.length > 0) {
        const insertPayload: FamilyMemberInsert[] = toInsert.map((m, idx) => ({
          patient_id: patientId,
          relationship: m.relationship,
          full_name: m.full_name || '',
          age: m.age ?? null,
          alive: m.alive,
          relationship_quality: m.relationship_quality || null,
          notes: m.notes || null,
          display_order: toUpdate.length + idx,
        }))
        const { error } = await supabase
          .from('patient_family_members')
          .insert(insertPayload)
        if (error) throw error
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: ['patientFamilyMembers', vars.patientId],
      })
      queryClient.invalidateQueries({ queryKey: ['patients'] })
    },
  })
}
