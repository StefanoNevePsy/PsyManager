import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { Database } from '@/types/database'

type Structure = Database['public']['Tables']['structures']['Row']
type StructureInsert = Database['public']['Tables']['structures']['Insert']
type StructureUpdate = Database['public']['Tables']['structures']['Update']
type PackageAgreement = Database['public']['Tables']['package_agreements']['Row']
type PackageAgreementInsert = Database['public']['Tables']['package_agreements']['Insert']
type PackageAgreementUpdate = Database['public']['Tables']['package_agreements']['Update']

export const useStructures = () => {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['structures', user?.id],
    queryFn: async () => {
      if (!user) return []
      const { data, error } = await supabase
        .from('structures')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true })

      if (error) throw error
      return data as Structure[]
    },
    enabled: !!user,
  })
}

export const useCreateStructure = () => {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (structure: Omit<StructureInsert, 'user_id'>) => {
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('structures')
        .insert({ ...structure, user_id: user.id })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['structures'] })
    },
  })
}

export const useUpdateStructure = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string
      updates: StructureUpdate
    }) => {
      const { data, error } = await supabase
        .from('structures')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['structures'] })
    },
  })
}

export const useDeleteStructure = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('structures').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['structures'] })
      queryClient.invalidateQueries({ queryKey: ['package_agreements'] })
    },
  })
}

export const usePackageAgreements = (structureId?: string) => {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['package_agreements', user?.id, structureId],
    queryFn: async () => {
      if (!user) return []
      let query = supabase
        .from('package_agreements')
        .select('*, structures(*)')
        .eq('user_id', user.id)
        .order('start_date', { ascending: false })

      if (structureId) {
        query = query.eq('structure_id', structureId)
      }

      const { data, error } = await query
      if (error) throw error
      return data as (PackageAgreement & { structures: Structure })[]
    },
    enabled: !!user,
  })
}

export const useCreatePackageAgreement = () => {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (agreement: Omit<PackageAgreementInsert, 'user_id'>) => {
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('package_agreements')
        .insert({ ...agreement, user_id: user.id })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['package_agreements'] })
    },
  })
}

export const useUpdatePackageAgreement = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string
      updates: PackageAgreementUpdate
    }) => {
      const { data, error } = await supabase
        .from('package_agreements')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['package_agreements'] })
    },
  })
}

export const useDeletePackageAgreement = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('package_agreements')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['package_agreements'] })
    },
  })
}
