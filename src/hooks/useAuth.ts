import { useAuthStore } from '@/stores/authStore'

export const useAuth = () => {
  const { user, session, loading, initialized, signIn, signUp, signOut, resetPassword } =
    useAuthStore()

  return {
    user,
    session,
    loading,
    initialized,
    isAuthenticated: !!user,
    signIn,
    signUp,
    signOut,
    resetPassword,
  }
}
