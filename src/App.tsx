import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { useTheme } from '@/hooks/useTheme'
import { useAuthStore } from '@/stores/authStore'
import { useGoogleCalendarLifecycle } from '@/hooks/useGoogleCalendarLifecycle'
import { useDeepLinks } from '@/hooks/useDeepLinks'
import { useSessionsWidget } from '@/hooks/useSessionsWidget'
import { useRemindersSync } from '@/hooks/useRemindersSync'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
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
import ClinicalNotesPage from '@/pages/ClinicalNotesPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      // Keep cached data around for 24h so it survives reloads & offline use
      gcTime: 1000 * 60 * 60 * 24,
      retry: 1,
      // 'offlineFirst' lets cached data be served immediately even when
      // offline; pending fetches resume automatically when online again
      networkMode: 'offlineFirst',
    },
    mutations: {
      // 'offlineFirst' queues mutations while offline and replays them
      // when connectivity returns
      networkMode: 'offlineFirst',
      retry: 2,
    },
  },
})

// Persist the query cache to localStorage so it survives reloads and is
// available when the device is offline. Bumping the buster invalidates the
// cache after deploys when the data shape changes.
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'psymanager-query-cache-v2',
})

// On the web the app lives under https://.../PsyManager/. In the Capacitor
// WebView it's served from the root, so the basename must be empty.
const basename =
  import.meta.env.PROD && !Capacitor.isNativePlatform() ? '/PsyManager' : ''

// Hooks that depend on the router and on authenticated React Query data are
// mounted inside <Router> via this component.
function AppRoutes() {
  useDeepLinks()
  useSessionsWidget()
  useRemindersSync()

  return (
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
        <Route path="/clinical-notes" element={<ClinicalNotesPage />} />
        <Route path="/service-types" element={<ServiceTypesPage />} />
        <Route path="/structures" element={<StructuresPage />} />
        <Route path="/payments" element={<PaymentsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

function App() {
  const { mounted } = useTheme()
  const { initialize } = useAuthStore()
  useGoogleCalendarLifecycle()

  useEffect(() => {
    initialize()
  }, [initialize])

  if (!mounted) {
    return null
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister }}
    >
      <ToastProvider>
        <PWAUpdatePrompt />
        <Router basename={basename}>
          <AppRoutes />
        </Router>
      </ToastProvider>
    </PersistQueryClientProvider>
  )
}

export default App
