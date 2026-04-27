import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'

interface UserProfile {
  id: string
  email: string
  full_name: string | null
}

export const useUserProfile = () => {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data: profile, isLoading } = useQuery({
    queryKey: ['userProfile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null
      const { data, error } = await supabase
        .from('users')
        .select('id, email, full_name')
        .eq('id', user.id)
        .maybeSingle()

      if (error) throw error

      if (!data) {
        // No row yet in public.users (e.g. account predates the auto-create trigger):
        // create one on the fly so subsequent reads/updates work.
        const { data: inserted, error: insertError } = await supabase
          .from('users')
          .insert({ id: user.id, email: user.email ?? '' })
          .select('id, email, full_name')
          .single()
        if (insertError) throw insertError
        return inserted as UserProfile
      }

      return data as UserProfile
    },
    enabled: !!user?.id,
  })

  const updateProfile = useMutation({
    mutationFn: async (updates: Partial<UserProfile>) => {
      if (!user?.id) throw new Error('User not authenticated')
      const { data, error } = await supabase
        .from('users')
        .upsert(
          {
            id: user.id,
            email: user.email ?? profile?.email ?? '',
            ...updates,
          },
          { onConflict: 'id' }
        )
        .select('id, email, full_name')
        .single()

      if (error) throw error
      return data as UserProfile
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['userProfile', user?.id], data)
      queryClient.invalidateQueries({ queryKey: ['userProfile'] })
    },
  })

  return {
    profile,
    isLoading,
    updateProfile: updateProfile.mutate,
    updateProfileAsync: updateProfile.mutateAsync,
    isUpdating: updateProfile.isPending,
    error: updateProfile.error,
  }
}
