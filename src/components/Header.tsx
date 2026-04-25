import { useTheme } from '@/hooks/useTheme'
import { useAuth } from '@/hooks/useAuth'
import { Moon, Sun, LogOut, Settings, User, Menu } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'

interface Props {
  onMenuClick?: () => void
}

export default function Header({ onMenuClick }: Props) {
  const { theme, toggleTheme } = useTheme()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 md:px-6 sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 rounded-lg hover:bg-secondary transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-semibold text-card-foreground">PsyManager</h1>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-secondary transition-colors"
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? (
            <Moon className="w-5 h-5" />
          ) : (
            <Sun className="w-5 h-5" />
          )}
        </button>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 rounded-lg hover:bg-secondary transition-colors flex items-center gap-2"
          >
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
              {user?.email?.[0].toUpperCase() || 'U'}
            </div>
          </button>

          {isOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-sm font-medium text-popover-foreground truncate">
                  {user?.email}
                </p>
              </div>
              <Link
                to="/settings"
                onClick={() => setIsOpen(false)}
                className="w-full text-left px-4 py-2 hover:bg-secondary flex items-center gap-2 text-popover-foreground"
              >
                <User className="w-4 h-4" />
                Profilo
              </Link>
              <Link
                to="/settings"
                onClick={() => setIsOpen(false)}
                className="w-full text-left px-4 py-2 hover:bg-secondary flex items-center gap-2 text-popover-foreground"
              >
                <Settings className="w-4 h-4" />
                Impostazioni
              </Link>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 hover:bg-secondary flex items-center gap-2 text-destructive border-t border-border"
              >
                <LogOut className="w-4 h-4" />
                Esci
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
