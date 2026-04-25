import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Calendar,
  CreditCard,
  BarChart3,
} from 'lucide-react'

const navigationItems = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Pazienti', path: '/patients', icon: Users },
  { label: 'Sedute', path: '/sessions', icon: Calendar },
  { label: 'Pagamenti', path: '/payments', icon: CreditCard },
  { label: 'Report', path: '/reports', icon: BarChart3 },
]

export default function Sidebar() {
  const location = useLocation()

  return (
    <aside className="w-64 bg-card border-r border-border h-screen overflow-y-auto">
      <nav className="p-6 space-y-2">
        {navigationItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-card-foreground hover:bg-secondary'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
