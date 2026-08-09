import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import { SmsAuthType, SmsBodyFormat } from '@/lib/smsProviders'

// ---------------------------------------------------------------------------
// sms_credentials / sms_credentials_status (migrations/015_sms_in_database.sql)
//
// `sms_credentials` is write-only from the client: it has INSERT and UPDATE
// RLS policies but deliberately no SELECT policy, so the app can save
// credentials but can never read them back. `sms_credentials_status` is a
// readable view exposing only non-secret metadata.
//
// These tables aren't in `src/types/database.ts` yet, and the shared
// `supabase` client isn't parameterized with the `Database` generic (see
// CLAUDE.md), so the calls below use explicit local types instead.
// ---------------------------------------------------------------------------

export interface SmsCredentialsStatus {
  user_id: string
  configured: boolean
  endpoint_host: string | null
  auth_type: SmsAuthType | null
  body_format: SmsBodyFormat | null
  updated_at: string | null
}

export interface SmsCredentialsInput {
  endpoint_url: string
  auth_type: SmsAuthType
  auth_user: string | null
  /**
   * Omit this key entirely (not just `''`) to leave the previously stored
   * secret untouched — the upsert only overwrites columns it receives, so a
   * blank re-save doesn't wipe out the saved credential.
   */
  auth_secret?: string
  body_format: SmsBodyFormat
  body_template: string
}

export const useSmsCredentialsStatus = () => {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['sms_credentials_status', user?.id],
    queryFn: async (): Promise<SmsCredentialsStatus | null> => {
      if (!user) return null
      const { data, error } = await supabase
        .from('sms_credentials_status')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) throw error
      return data as SmsCredentialsStatus | null
    },
    enabled: !!user,
  })
}

export const useSaveSmsCredentials = () => {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (input: SmsCredentialsInput) => {
      if (!user) throw new Error('Not authenticated')

      const payload: Record<string, unknown> = {
        user_id: user.id,
        endpoint_url: input.endpoint_url,
        auth_type: input.auth_type,
        auth_user: input.auth_user,
        body_format: input.body_format,
        body_template: input.body_template,
      }

      // Only include auth_secret when the caller actually provided one.
      // Supabase's upsert only sets the columns present in the payload, so
      // leaving the key out on a re-save keeps whatever secret is already
      // stored server-side (which the app can never read to pre-fill).
      if (input.auth_secret !== undefined) {
        payload.auth_secret = input.auth_secret
      }

      // No `.select()` here on purpose: sms_credentials has INSERT/UPDATE
      // policies but no SELECT policy, so asking PostgREST to return the
      // written row would fail with a permissions error.
      const { error } = await supabase
        .from('sms_credentials')
        .upsert(payload, { onConflict: 'user_id' })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms_credentials_status'] })
    },
  })
}

export const useSendTestSms = () => {
  return useMutation({
    mutationFn: async (phone: string): Promise<unknown> => {
      const { data, error } = await supabase.rpc('send_test_sms', { p_phone: phone })
      // Surface the Postgres exception message as-is (e.g. "missing SMS
      // credentials" raised by the RPC when nothing is configured).
      if (error) throw error
      return data
    },
  })
}
