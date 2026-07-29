import { useEffect } from 'react'
import { create } from 'zustand'
import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

// ---------------------------------------------------------------------------
// App Lock
//
// A device-scoped PIN lock for the app UI. This is NOT encryption: it only
// gates the screen while the underlying data (in memory, in the Supabase
// session, in IndexedDB/localStorage caches) is untouched. Its purpose is to
// stop someone from casually picking up an unlocked/shared device and
// browsing clinical data, not to protect against a determined attacker with
// filesystem access.
//
// Settings + the PIN hash live in localStorage under 'psymanager:lock',
// scoped to this device/browser profile — never synced to the DB.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'psymanager:lock'

const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 30_000

interface StoredLockSettings {
  enabled: boolean
  autoLockMinutes: number
  pinHash: string
  pinSalt: string
  pinLength: number
}

interface AppLockState {
  enabled: boolean
  locked: boolean
  autoLockMinutes: number
  pinLength: number
  attempts: number
  blockedUntil: number | null

  isEnabled: () => boolean
  setPin: (pin: string) => Promise<void>
  verifyPin: (pin: string) => Promise<boolean>
  disableLock: (currentPin: string) => Promise<boolean>
  lock: () => void
  unlock: () => void
  setAutoLockMinutes: (n: number) => void
}

// --- localStorage persistence (settings only, never the raw PIN) ----------

function readStoredSettings(): StoredLockSettings | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredLockSettings
    if (!parsed || typeof parsed.pinHash !== 'string' || typeof parsed.pinSalt !== 'string') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeStoredSettings(settings: StoredLockSettings | null) {
  try {
    if (!settings) {
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // localStorage unavailable (private mode, quota, etc.) — fail silently,
    // the lock simply won't persist across reloads.
  }
}

// --- PIN hashing (Web Crypto, SHA-256 over `${salt}:${pin}`) --------------

function randomSaltHex(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function hashPin(pin: string, salt: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(`${salt}:${pin}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// --- Background/foreground + visibility tracking for auto-lock ------------

let backgroundedAt: number | null = null
let listenersAttached = false

function attachLifecycleListeners(get: () => AppLockState) {
  if (listenersAttached) return
  listenersAttached = true

  const maybeAutoLock = () => {
    const state = get()
    if (!state.enabled || backgroundedAt === null) return
    const elapsedMs = Date.now() - backgroundedAt
    backgroundedAt = null
    if (elapsedMs > state.autoLockMinutes * 60_000) {
      state.lock()
    }
  }

  if (Capacitor.isNativePlatform()) {
    CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        backgroundedAt = Date.now()
      } else {
        maybeAutoLock()
      }
    })
  }

  // Web (and also fires inside native WebViews): tab/app visibility changes.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      backgroundedAt = Date.now()
    } else {
      maybeAutoLock()
    }
  })
}

const stored = readStoredSettings()

export const useAppLockStore = create<AppLockState>((set, get) => ({
  enabled: stored?.enabled ?? false,
  // Start locked on a fresh load whenever the lock is enabled.
  locked: stored?.enabled ?? false,
  autoLockMinutes: stored?.autoLockMinutes ?? 5,
  pinLength: stored?.pinLength ?? 0,
  attempts: 0,
  blockedUntil: null,

  isEnabled: () => get().enabled,

  setPin: async (pin: string) => {
    const salt = randomSaltHex()
    const pinHash = await hashPin(pin, salt)
    const current = readStoredSettings()
    const next: StoredLockSettings = {
      enabled: true,
      autoLockMinutes: current?.autoLockMinutes ?? get().autoLockMinutes,
      pinHash,
      pinSalt: salt,
      pinLength: pin.length,
    }
    writeStoredSettings(next)
    set({
      enabled: true,
      autoLockMinutes: next.autoLockMinutes,
      pinLength: pin.length,
      locked: false,
      attempts: 0,
      blockedUntil: null,
    })
  },

  verifyPin: async (pin: string) => {
    const { attempts, blockedUntil } = get()
    if (blockedUntil !== null && Date.now() < blockedUntil) {
      return false
    }

    const settings = readStoredSettings()
    if (!settings) return false

    const candidateHash = await hashPin(pin, settings.pinSalt)
    const isMatch = candidateHash === settings.pinHash

    if (isMatch) {
      set({ attempts: 0, blockedUntil: null })
      return true
    }

    const nextAttempts = attempts + 1
    if (nextAttempts >= MAX_ATTEMPTS) {
      set({ attempts: nextAttempts, blockedUntil: Date.now() + LOCKOUT_MS })
    } else {
      set({ attempts: nextAttempts })
    }
    return false
  },

  disableLock: async (currentPin: string) => {
    const ok = await get().verifyPin(currentPin)
    if (!ok) return false

    writeStoredSettings(null)
    set({
      enabled: false,
      locked: false,
      pinLength: 0,
      attempts: 0,
      blockedUntil: null,
    })
    return true
  },

  lock: () => {
    if (!get().enabled) return
    set({ locked: true })
  },

  unlock: () => set({ locked: false }),

  setAutoLockMinutes: (n: number) => {
    const current = readStoredSettings()
    if (current) {
      writeStoredSettings({ ...current, autoLockMinutes: n })
    }
    set({ autoLockMinutes: n })
  },
}))

/**
 * Wires up the background/foreground and visibility listeners that drive
 * auto-lock. Call once near the app root (e.g. in App.tsx or AppLock.tsx).
 */
export function useAppLock() {
  useEffect(() => {
    attachLifecycleListeners(useAppLockStore.getState)
  }, [])

  return useAppLockStore()
}
