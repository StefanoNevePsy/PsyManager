import { useTheme } from '@/hooks/useTheme'
import { useAuth } from '@/hooks/useAuth'
import { Moon, Sun, LogOut, Settings, User, Menu } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Tooltip } from '@/components/ui'
import SyncStatusIndicator from '@/components/SyncStatusIndicator'

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

  const initial = user?.email?.[0].toUpperCase() || 'U'
  const username = user?.email?.split('@')[0] || ''

  return (
    <header className="h-16 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between px-4 md:px-6 sticky top-0 z-40">
      <div className="flex items-center gap-2">
        <button
          onClick={onMenuClick}
          className="md:hidden -ml-2 p-2 rounded-md hover:bg-secondary transition-colors"
          aria-label="Apri menu di navigazione"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Link to="/" className="md:hidden flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-display text-base font-bold">
            ψ
          </div>
          <span className="font-display text-lg font-semibold text-foreground tracking-tight">
            PsyManager
          </span>
        </Link>
      </div>

      <div className="flex items-center gap-1">
        <SyncStatusIndicator />

        <Tooltip
          label={theme === 'light' ? 'Passa al tema scuro' : 'Passa al tema chiaro'}
          side="bottom"
        >
          <button
            onClick={toggleTheme}
            aria-label={
              theme === 'light' ? 'Passa al tema scuro' : 'Passa al tema chiaro'
            }
            className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-secondary/70 transition-colors text-muted-foreground hover:text-foreground"
          >
            {theme === 'light' ? (
              <Moon className="w-[18px] h-[18px]" strokeWidth={1.85} />
            ) : (
              <Sun className="w-[18px] h-[18px]" strokeWidth={1.85} />
            )}
          </button>
        </Tooltip>

        <div className="relative ml-1" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Menu utente"
            aria-expanded={isOpen}
            className="h-9 pl-1 pr-2 rounded-full hover:bg-secondary/70 transition-colors flex items-center gap-2"
          >
            <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
              {initial}
            </div>
            <span className="hidden md:inline text-sm font-medium text-foreground max-w-[120px] truncate">
              {username}
            </span>
          </button>

          {isOpen && (
            <div className="absolute right-0 mt-2 w-60 bg-popover border border-border rounded-lg shadow-pop z-50 overflow-hidden animate-scale-in origin-top-right">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-2xs uppercase tracking-wider text-muted-foreground font-medium mb-0.5">
                  Connesso come
                </p>
                <p className="text-sm font-medium text-popover-foreground truncate">
                  {user?.email}
                </p>
              </div>
              <div className="py-1">
                <Link
                  to="/settings"
                  onClick={() => setIsOpen(false)}
                  className="w-full text-left px-4 py-2 hover:bg-secondary flex items-center gap-2.5 text-sm text-popover-foreground"
                >
                  <User className="w-4 h-4 text-muted-foreground" strokeWidth={1.85} />
                  Profilo
                </Link>
                <Link
                  to="/settings"
                  onClick={() => setIsOpen(false)}
                  className="w-full text-left px-4 py-2 hover:bg-secondary flex items-center gap-2.5 text-sm text-popover-foreground"
                >
                  <Settings className="w-4 h-4 text-muted-foreground" strokeWidth={1.85} />
                  Impostazioni
                </Link>
              </div>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2.5 hover:bg-destructive-soft flex items-center gap-2.5 text-sm text-destructive border-t border-border"
              >
                <LogOut className="w-4 h-4" strokeWidth={1.85} />
                Esci
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
