import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useTheme } from '@/hooks/useTheme'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import Layout from '@/components/Layout'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import PatientsPage from '@/pages/PatientsPage'
import SessionsPage from '@/pages/SessionsPage'
import PaymentsPage from '@/pages/PaymentsPage'
import ReportsPage from '@/pages/ReportsPage'
import SettingsPage from '@/pages/SettingsPage'

const queryClient = new QueryClient()

function App() {
  const { mounted } = useTheme()

  if (!mounted) {
    return null
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/patients" element={<PatientsPage />} />
            <Route path="/sessions" element={<SessionsPage />} />
            <Route path="/payments" element={<PaymentsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Router>
    </QueryClientProvider>
  )
}

export default App
