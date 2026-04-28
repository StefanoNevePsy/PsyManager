import { useEffect, useState } from 'react'
import { onlineManager } from '@tanstack/react-query'

/**
 * Returns true when the browser/device has network connectivity.
 *
 * Uses both the browser's online/offline events and TanStack Query's
 * onlineManager so the UI stays in sync with what the query layer thinks.
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  )

  useEffect(() => {
    const update = () => {
      const online = navigator.onLine
      setIsOnline(online)
      onlineManager.setOnline(online)
    }

    window.addEventListener('online', update)
    window.addEventListener('offline', update)

    // Sync TanStack Query state with current value on mount
    onlineManager.setOnline(navigator.onLine)

    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  return isOnline
}
