import { useEffect, useMemo, useRef, useState } from 'react'
import { Delete, Lock } from 'lucide-react'
import { useAppLock } from '@/hooks/useAppLock'

const MAX_PIN_LENGTH = 6

/**
 * Full-screen PIN gate. Renders nothing when the lock is disabled or
 * unlocked; when locked, blocks all interaction with the app underneath.
 *
 * Mount this once near the app root (e.g. inside App.tsx) alongside the
 * other routes so it can overlay them regardless of the current page.
 */
export default function AppLock() {
  const { enabled, locked, pinLength, attempts, blockedUntil, verifyPin, unlock } = useAppLock()
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [remainingLockoutSec, setRemainingLockoutSec] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const isBlocked = blockedUntil !== null && Date.now() < blockedUntil

  useEffect(() => {
    if (locked) {
      setPin('')
      setError(null)
      // Slight delay so the overlay is mounted before we try to focus it.
      const t = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [locked])

  // Countdown while the lockout is active.
  useEffect(() => {
    if (!blockedUntil) {
      setRemainingLockoutSec(0)
      return
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((blockedUntil - Date.now()) / 1000))
      setRemainingLockoutSec(remaining)
    }
    tick()
    const interval = setInterval(tick, 250)
    return () => clearInterval(interval)
  }, [blockedUntil])

  const expectedLength = useMemo(() => pinLength || MAX_PIN_LENGTH, [pinLength])

  const submit = async (candidate: string) => {
    if (!candidate || isBlocked || verifying) return
    setVerifying(true)
    setError(null)
    try {
      const ok = await verifyPin(candidate)
      if (ok) {
        unlock()
        setPin('')
      } else {
        setPin('')
        const remaining = Math.max(0, 5 - (attempts + 1))
        if (remaining === 0) {
          setError('Troppi tentativi errati. Riprova tra 30 secondi.')
        } else {
          setError(`PIN errato — ${remaining} tentativi rimasti`)
        }
      }
    } finally {
      setVerifying(false)
    }
  }

  useEffect(() => {
    if (pin.length > 0 && pin.length === expectedLength) {
      void submit(pin)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, expectedLength])

  if (!enabled || !locked) {
    return null
  }

  const handleDigit = (digit: string) => {
    if (isBlocked || verifying) return
    setPin((prev) => (prev.length >= MAX_PIN_LENGTH ? prev : prev + digit))
  }

  const handleBackspace = () => {
    if (isBlocked || verifying) return
    setPin((prev) => prev.slice(0, -1))
  }

  const handleClear = () => {
    if (isBlocked || verifying) return
    setPin('')
  }

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-xs flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-full bg-primary-soft flex items-center justify-center mb-4">
          <Lock className="w-6 h-6 text-primary" strokeWidth={2} />
        </div>
        <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">
          PsyManager
        </h1>
        <p className="text-sm text-muted-foreground mt-1 mb-6">Inserisci il PIN</p>

        {/* Hidden numeric input: drives autofocus, keyboard entry and Enter-to-submit */}
        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoFocus
          value={pin}
          maxLength={MAX_PIN_LENGTH}
          disabled={isBlocked || verifying}
          onChange={(e) => {
            const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, MAX_PIN_LENGTH)
            setPin(digitsOnly)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit(pin)
          }}
          aria-label="PIN"
          className="sr-only"
        />

        {/* PIN dots */}
        <div className="flex items-center justify-center gap-3 mb-2" aria-hidden="true">
          {Array.from({ length: expectedLength }).map((_, i) => (
            <span
              key={i}
              className={`w-3.5 h-3.5 rounded-full border-2 transition-colors ${
                i < pin.length ? 'bg-primary border-primary' : 'border-border'
              }`}
            />
          ))}
        </div>

        <div className="h-10 flex items-center justify-center">
          {isBlocked ? (
            <p className="text-xs font-medium text-destructive">
              Troppi tentativi. Riprova tra {remainingLockoutSec}s
            </p>
          ) : error ? (
            <p className="text-xs font-medium text-destructive">{error}</p>
          ) : null}
        </div>

        {/* Numeric keypad, one-handed friendly */}
        <div className="grid grid-cols-3 gap-3 mt-4 w-full">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              disabled={isBlocked || verifying}
              className="h-14 rounded-full text-lg font-medium text-foreground bg-secondary/60 hover:bg-secondary active:bg-secondary/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            disabled={isBlocked || verifying}
            className="h-14 rounded-full text-xs font-medium text-muted-foreground hover:bg-secondary/60 active:bg-secondary/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Cancella
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            disabled={isBlocked || verifying}
            className="h-14 rounded-full text-lg font-medium text-foreground bg-secondary/60 hover:bg-secondary active:bg-secondary/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            disabled={isBlocked || verifying}
            aria-label="Backspace"
            className="h-14 rounded-full flex items-center justify-center text-muted-foreground hover:bg-secondary/60 active:bg-secondary/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Delete className="w-5 h-5" strokeWidth={1.85} />
          </button>
        </div>

        <p className="text-xs text-muted-foreground/80 mt-8 leading-relaxed">
          Il PIN protegge l'accesso all'app su questo dispositivo. Non è una
          cifratura dei dati.
        </p>
      </div>
    </div>
  )
}
