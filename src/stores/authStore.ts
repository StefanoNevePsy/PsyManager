import { create } from 'zustand'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

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
    const {
      data: { session },
    } = await supabase.auth.getSession()

    set({
      session,
      user: session?.user ?? null,
      initialized: true,
    })

    supabase.auth.onAuthStateChange((_event, session) => {
      set({
        session,
        user: session?.user ?? null,
      })
    })
  },
}))
