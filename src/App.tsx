import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useTheme } from '@/hooks/useTheme'
import { useAuthStore } from '@/stores/authStore'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import PWAUpdatePrompt from '@/components/PWAUpdatePrompt'
import { ToastProvider } from '@/components/ui'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import PatientsPage from '@/pages/PatientsPage'
import SessionsPage from '@/pages/SessionsPage'
import PaymentsPage from '@/pages/PaymentsPage'
import ReportsPage from '@/pages/ReportsPage'
import SettingsPage from '@/pages/SettingsPage'
import ServiceTypesPage from '@/pages/ServiceTypesPage'
import StructuresPage from '@/pages/StructuresPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
})

const basename = import.meta.env.PROD ? '/PsyManager' : ''

function App() {
  const { mounted } = useTheme()
  const { initialize } = useAuthStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  if (!mounted) {
    return null
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <PWAUpdatePrompt />
        <Router basename={basename}>
          <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route path="/patients" element={<PatientsPage />} />
            <Route path="/sessions" element={<SessionsPage />} />
            <Route path="/service-types" element={<ServiceTypesPage />} />
            <Route path="/structures" element={<StructuresPage />} />
            <Route path="/payments" element={<PaymentsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        </Router>
      </ToastProvider>
    </QueryClientProvider>
  )
}

export default App
