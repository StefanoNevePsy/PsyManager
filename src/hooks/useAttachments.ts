import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { Database } from '@/types/database'

type Attachment = Database['public']['Tables']['attachments']['Row']
type AttachmentOwnerType = 'patient' | 'clinical_note'

const BUCKET = 'patient-attachments'

export const useAttachments = (
  ownerType: AttachmentOwnerType,
  ownerId: string | undefined
) => {
  return useQuery({
    queryKey: ['attachments', ownerType, ownerId],
    queryFn: async () => {
      if (!ownerId) return []
      const { data, error } = await supabase
        .from('attachments')
        .select('*')
        .eq('owner_type', ownerType)
        .eq('owner_id', ownerId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Attachment[]
    },
    enabled: !!ownerId,
  })
}

/**
 * Generate a signed URL valid for 1 hour for previewing/downloading an attachment.
 * Files are stored privately and accessed only via signed URL.
 */
export const getAttachmentUrl = async (storagePath: string): Promise<string> => {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60 * 60)
  if (error) throw error
  return data.signedUrl
}

export const useUploadAttachment = () => {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      file,
      ownerType,
      ownerId,
      description,
    }: {
      file: File
      ownerType: AttachmentOwnerType
      ownerId: string
      description?: string
    }) => {
      if (!user) throw new Error('Not authenticated')

      // Build a path under the user's folder (RLS enforces this prefix)
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = `${user.id}/${ownerType}/${ownerId}/${Date.now()}_${safeName}`

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        })
      if (uploadError) throw uploadError

      const { data, error: insertError } = await supabase
        .from('attachments')
        .insert({
          user_id: user.id,
          owner_type: ownerType,
          owner_id: ownerId,
          file_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
          storage_path: storagePath,
          description: description ?? null,
        })
        .select()
        .single()

      if (insertError) {
        // Roll back the storage upload if the row insert failed
        await supabase.storage.from(BUCKET).remove([storagePath])
        throw insertError
      }

      return data as Attachment
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: ['attachments', vars.ownerType, vars.ownerId],
      })
    },
  })
}

export const useDeleteAttachment = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (attachment: Attachment) => {
      // Delete the row first (cheap, fast); then the file
      const { error: rowError } = await supabase
        .from('attachments')
        .delete()
        .eq('id', attachment.id)
      if (rowError) throw rowError

      const { error: storageError } = await supabase.storage
        .from(BUCKET)
        .remove([attachment.storage_path])
      // Don't throw on storage error: the row is gone, file may already be missing
      if (storageError) {
        console.warn('Storage cleanup failed (non-fatal):', storageError)
      }
    },
    onSuccess: (_, attachment) => {
      queryClient.invalidateQueries({
        queryKey: ['attachments', attachment.owner_type, attachment.owner_id],
      })
    },
  })
}
