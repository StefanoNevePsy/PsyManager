import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database'

type PatientContact = Database['public']['Tables']['patient_contacts']['Row']
type PatientContactInsert = Database['public']['Tables']['patient_contacts']['Insert']

export const usePatientContacts = (patientId: string | undefined) => {
  return useQuery({
    queryKey: ['patientContacts', patientId],
    queryFn: async () => {
      if (!patientId) return []
      const { data, error } = await supabase
        .from('patient_contacts')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as PatientContact[]
    },
    enabled: !!patientId,
  })
}

/**
 * Replace all contacts for a patient with a new set.
 * Deletes any existing contacts not in the new list (by id), upserts the rest,
 * and inserts new ones (without id).
 */
export const useReplacePatientContacts = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      patientId,
      contacts,
    }: {
      patientId: string
      contacts: Array<{
        id?: string
        kind: 'phone' | 'email'
        label?: string | null
        value: string
      }>
    }) => {
      // Fetch existing to determine deletes
      const { data: existing, error: fetchError } = await supabase
        .from('patient_contacts')
        .select('id')
        .eq('patient_id', patientId)
      if (fetchError) throw fetchError

      const newIds = new Set(contacts.map((c) => c.id).filter(Boolean) as string[])
      const toDelete = (existing as { id: string }[])
        .filter((e) => !newIds.has(e.id))
        .map((e) => e.id)

      if (toDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('patient_contacts')
          .delete()
          .in('id', toDelete)
        if (deleteError) throw deleteError
      }

      // Update existing (with id) and insert new (without id)
      const toUpdate = contacts.filter((c) => c.id)
      const toInsert = contacts.filter((c) => !c.id)

      for (const c of toUpdate) {
        const { error } = await supabase
          .from('patient_contacts')
          .update({
            kind: c.kind,
            label: c.label || '',
            value: c.value,
          })
          .eq('id', c.id!)
        if (error) throw error
      }

      if (toInsert.length > 0) {
        const insertPayload: PatientContactInsert[] = toInsert.map((c) => ({
          patient_id: patientId,
          kind: c.kind,
          label: c.label || '',
          value: c.value,
        }))
        const { error } = await supabase.from('patient_contacts').insert(insertPayload)
        if (error) throw error
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['patientContacts', vars.patientId] })
      queryClient.invalidateQueries({ queryKey: ['patients'] })
    },
  })
}
