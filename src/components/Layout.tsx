import { Outlet } from 'react-router-dom'
import { useTheme } from '@/hooks/useTheme'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'

export default function Layout() {
  const { theme } = useTheme()

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className="flex h-screen bg-background text-foreground">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
