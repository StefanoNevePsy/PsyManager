import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useTheme } from '@/hooks/useTheme'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import OnboardingWizard from '@/components/OnboardingWizard'

export default function Layout() {
  const { theme } = useTheme()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      {/* h-[100dvh] (not h-screen/100vh) so mobile browser chrome that
          resizes the viewport doesn't leave a stale gap or clip content. */}
      <div className="flex h-[100dvh] bg-background text-foreground">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
        <OnboardingWizard />
      </div>
    </div>
  )
}
