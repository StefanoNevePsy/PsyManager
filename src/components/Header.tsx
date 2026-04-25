import { useTheme } from '@/hooks/useTheme'
import { Moon, Sun, LogOut, Settings } from 'lucide-react'
import { useState } from 'react'

export default function Header() {
  const { theme, toggleTheme } = useTheme()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold text-card-foreground">PsyManager</h1>
      </div>

      <div className="flex items-center gap-4">
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

        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>

          {isOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-popover border border-border rounded-lg shadow-lg z-50">
              <button className="w-full text-left px-4 py-2 hover:bg-secondary flex items-center gap-2 rounded-t-lg">
                <Settings className="w-4 h-4" />
                Impostazioni
              </button>
              <button className="w-full text-left px-4 py-2 hover:bg-secondary flex items-center gap-2 border-t border-border rounded-b-lg">
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
