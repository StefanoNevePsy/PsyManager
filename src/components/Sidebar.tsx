import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Calendar,
  CreditCard,
  BarChart3,
  Briefcase,
  Building2,
  Settings,
  X,
} from 'lucide-react'

const navigationItems = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Pazienti', path: '/patients', icon: Users },
  { label: 'Sedute', path: '/sessions', icon: Calendar },
  { label: 'Tipi Prestazione', path: '/service-types', icon: Briefcase },
  { label: 'Strutture', path: '/structures', icon: Building2 },
  { label: 'Pagamenti', path: '/payments', icon: CreditCard },
  { label: 'Report', path: '/reports', icon: BarChart3 },
  { label: 'Impostazioni', path: '/settings', icon: Settings },
]

interface Props {
  isOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({ isOpen, onClose }: Props) {
  const location = useLocation()

  const sidebarContent = (
    <nav className="p-4 md:p-6 space-y-1 overflow-y-auto h-full">
      <div className="md:hidden flex justify-end mb-4">
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-secondary transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      {navigationItems.map((item) => {
        const Icon = item.icon
        const isActive =
          location.pathname === item.path ||
          (item.path !== '/' && location.pathname.startsWith(item.path))
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={onClose}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-card-foreground hover:bg-secondary'
            }`}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:block w-64 bg-card border-r border-border h-screen overflow-hidden flex-shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`md:hidden fixed top-0 left-0 w-64 h-screen bg-card border-r border-border z-50 transform transition-transform ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  )
}
