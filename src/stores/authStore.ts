import { create } from 'zustand'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { clearLocalUserData } from '@/lib/localData'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  initialized: boolean

  setSession: (session: Session | null) => void
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: Error | null }>
  initialize: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: false,
  initialized: false,

  setSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
    }),

  signIn: async (email, password) => {
    set({ loading: true })
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      set({
        session: data.session,
        user: data.user,
        loading: false,
      })

      return { error: null }
    } catch (error) {
      set({ loading: false })
      return { error: error as Error }
    }
  },

  signUp: async (email, password) => {
    set({ loading: true })
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/PsyManager/`,
        },
      })

      if (error) throw error

      set({
        session: data.session,
        user: data.user,
        loading: false,
      })

      return { error: null }
    } catch (error) {
      set({ loading: false })
      return { error: error as Error }
    }
  },

  signOut: async () => {
    set({ loading: true })
    await supabase.auth.signOut()
    // Signing out must leave nothing behind on the device: the persisted
    // query cache holds patients, sessions and clinical notes in plaintext,
    // and the Google token stays valid for its remaining lifetime. On a
    // shared/clinic device the next person would otherwise still reach them.
    clearLocalUserData()
    set({
      user: null,
      session: null,
      loading: false,
    })
  },

  resetPassword: async (email) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/PsyManager/reset-password`,
      })

      if (error) throw error

      return { error: null }
    } catch (error) {
      return { error: error as Error }
    }
  },

  initialize: async () => {
    // Guard against double-invocation (HMR, remount)
    if (authListenerAttached) return
    authListenerAttached = true

    const {
      data: { session },
    } = await supabase.auth.getSession()

    set({
      session,
      user: session?.user ?? null,
      initialized: true,
    })

    supabase.auth.onAuthStateChange((event, session) => {
      // Offline resilience: if the token refresh fails while offline the
      // session comes back null WITHOUT an explicit SIGNED_OUT. Dropping the
      // user would bounce them to a login screen they can't complete offline,
      // even though all their data sits in the persisted cache. Keep the
      // last-known session until we're back online or they truly sign out.
      if (
        !session &&
        event !== 'SIGNED_OUT' &&
        typeof navigator !== 'undefined' &&
        navigator.onLine === false
      ) {
        console.warn('[auth] token refresh failed offline — keeping last session')
        return
      }
      set({
        session,
        user: session?.user ?? null,
      })
    })
  },
}))

// Module-level so hot reloads don't attach duplicate listeners
let authListenerAttached = false
