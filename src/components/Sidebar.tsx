import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Calendar,
  CreditCard,
  BarChart3,
  Briefcase,
  Building2,
  BookOpen,
  Settings,
  X,
  type LucideIcon,
} from 'lucide-react'
import { clsx } from 'clsx'

interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  group: 'main' | 'manage' | 'system'
}

const navigationItems: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard, group: 'main' },
  { label: 'Pazienti', path: '/patients', icon: Users, group: 'main' },
  { label: 'Sedute', path: '/sessions', icon: Calendar, group: 'main' },
  { label: 'Diario clinico', path: '/clinical-notes', icon: BookOpen, group: 'main' },
  { label: 'Pagamenti', path: '/payments', icon: CreditCard, group: 'main' },
  { label: 'Tipi prestazione', path: '/service-types', icon: Briefcase, group: 'manage' },
  { label: 'Strutture', path: '/structures', icon: Building2, group: 'manage' },
  { label: 'Report', path: '/reports', icon: BarChart3, group: 'manage' },
  { label: 'Impostazioni', path: '/settings', icon: Settings, group: 'system' },
]

const groupLabels: Record<NavItem['group'], string> = {
  main: 'Lavoro quotidiano',
  manage: 'Gestione',
  system: 'Sistema',
}

interface Props {
  isOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({ isOpen, onClose }: Props) {
  const location = useLocation()

  const isActive = (path: string) =>
    location.pathname === path || (path !== '/' && location.pathname.startsWith(path))

  const groupedItems = (Object.keys(groupLabels) as NavItem['group'][]).map((group) => ({
    group,
    label: groupLabels[group],
    items: navigationItems.filter((i) => i.group === group),
  }))

  const sidebarContent = (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Brand */}
      <div className="flex items-center justify-between px-5 pt-6 pb-5 flex-shrink-0">
        <Link to="/" onClick={onClose} className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-display text-lg font-bold tracking-tight group-hover:scale-105 transition-transform">
            ψ
          </div>
          <span className="font-display text-xl font-semibold text-foreground tracking-tight">
            PsyManager
          </span>
        </Link>
        <button
          onClick={onClose}
          className="md:hidden p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground"
          aria-label="Chiudi menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-6">
        {groupedItems.map(({ group, label, items }) => (
          <div key={group}>
            <p className="px-3 mb-1.5 text-2xs font-semibold tracking-wider uppercase text-muted-foreground/80">
              {label}
            </p>
            <div className="space-y-0.5">
              {items.map((item) => {
                const Icon = item.icon
                const active = isActive(item.path)
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={clsx(
                      'group relative flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors duration-150 ease-out-quart',
                      active
                        ? 'bg-primary-soft text-primary font-medium'
                        : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                    )}
                  >
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-primary rounded-full"
                      />
                    )}
                    <Icon
                      className={clsx(
                        'w-[18px] h-[18px] flex-shrink-0 transition-colors',
                        active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                      )}
                      strokeWidth={active ? 2.25 : 1.85}
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-border/60 flex-shrink-0">
        <p className="text-2xs text-muted-foreground/70 leading-relaxed">
          PsyManager <span className="tabular-nums">v1.0</span>
          <br />
          <span className="text-muted-foreground/60">Gestionale per terapeuti</span>
        </p>
      </div>
    </div>
  )

  return (
    <>
      <aside className="hidden md:flex w-60 bg-card border-r border-border flex-shrink-0 flex-col">
        {sidebarContent}
      </aside>

      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-foreground/40 backdrop-blur-sm z-40 animate-fade-in"
          onClick={onClose}
        />
      )}

      <aside
        className={clsx(
          'md:hidden fixed top-0 left-0 w-72 max-w-[85vw] h-screen bg-card border-r border-border z-50 transform transition-transform duration-300 ease-out-quart',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>
    </>
  )
}
