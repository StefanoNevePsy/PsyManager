import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

// Storage can be unavailable inside a WebView (blocked cookies, private
// mode, quota). Never let that stop the app from rendering.
const readStoredTheme = (): Theme | null => {
  try {
    const value = localStorage.getItem('theme')
    return value === 'dark' || value === 'light' ? value : null
  } catch {
    return null
  }
}

const storeTheme = (theme: Theme) => {
  try {
    localStorage.setItem('theme', theme)
  } catch {
    // ignore — the theme simply won't persist
  }
}

const prefersDarkScheme = (): boolean => {
  try {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  } catch {
    return false
  }
}

const applyTheme = (newTheme: Theme) => {
  const root = document.documentElement
  if (newTheme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
  storeTheme(newTheme)
}

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    try {
      const initialTheme = readStoredTheme() ?? (prefersDarkScheme() ? 'dark' : 'light')
      setTheme(initialTheme)
      applyTheme(initialTheme)
    } catch {
      // Fall through: rendering with the default theme beats not rendering
    } finally {
      // Always set last: the app renders nothing until this flips, so it must
      // happen even when reading the stored preference fails.
      setMounted(true)
    }
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    applyTheme(newTheme)
  }

  return { theme, toggleTheme, mounted }
}
