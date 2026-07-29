import { useState } from 'react'
import { Lock, ShieldCheck, KeyRound, Info } from 'lucide-react'
import { useAppLockStore } from '@/hooks/useAppLock'
import { Button, Card, Input, Select, useToast } from '@/components/ui'

const AUTO_LOCK_OPTIONS = [
  { value: '0', label: 'Subito' },
  { value: '1', label: '1 minuto' },
  { value: '5', label: '5 minuti' },
  { value: '15', label: '15 minuti' },
  { value: '60', label: '60 minuti' },
]

const PIN_PATTERN = /^\d{4,6}$/

function sanitizeDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 6)
}

/**
 * Settings section for the local (device-only) app PIN lock. Meant to be
 * mounted directly inside SettingsPage, e.g.:
 *
 *   <AppLockSettings />
 */
export default function AppLockSettings() {
  const { toast } = useToast()
  const { enabled, autoLockMinutes, setPin, disableLock, setAutoLockMinutes, verifyPin } =
    useAppLockStore()

  // --- Enable flow (disabled -> enabled) ---
  const [showEnableForm, setShowEnableForm] = useState(false)
  const [newPin, setNewPin] = useState('')
  const [newPinConfirm, setNewPinConfirm] = useState('')
  const [enableError, setEnableError] = useState<string | null>(null)
  const [enabling, setEnabling] = useState(false)

  // --- Change PIN flow ---
  const [showChangeForm, setShowChangeForm] = useState(false)
  const [currentPinForChange, setCurrentPinForChange] = useState('')
  const [changeNewPin, setChangeNewPin] = useState('')
  const [changeNewPinConfirm, setChangeNewPinConfirm] = useState('')
  const [changeError, setChangeError] = useState<string | null>(null)
  const [changing, setChanging] = useState(false)

  // --- Disable flow ---
  const [showDisableForm, setShowDisableForm] = useState(false)
  const [disablePin, setDisablePin] = useState('')
  const [disableError, setDisableError] = useState<string | null>(null)
  const [disabling, setDisabling] = useState(false)

  const resetEnableForm = () => {
    setShowEnableForm(false)
    setNewPin('')
    setNewPinConfirm('')
    setEnableError(null)
  }

  const resetChangeForm = () => {
    setShowChangeForm(false)
    setCurrentPinForChange('')
    setChangeNewPin('')
    setChangeNewPinConfirm('')
    setChangeError(null)
  }

  const resetDisableForm = () => {
    setShowDisableForm(false)
    setDisablePin('')
    setDisableError(null)
  }

  const handleEnable = async () => {
    if (!PIN_PATTERN.test(newPin)) {
      setEnableError('Il PIN deve avere da 4 a 6 cifre')
      return
    }
    if (newPin !== newPinConfirm) {
      setEnableError('I due PIN non coincidono')
      return
    }
    setEnabling(true)
    setEnableError(null)
    try {
      await setPin(newPin)
      toast.success('Blocco con PIN attivato')
      resetEnableForm()
    } catch (error) {
      toast.error('Errore nell’attivazione del blocco', {
        description: error instanceof Error ? error.message : 'Riprova',
      })
    } finally {
      setEnabling(false)
    }
  }

  const handleChangePin = async () => {
    if (!PIN_PATTERN.test(changeNewPin)) {
      setChangeError('Il nuovo PIN deve avere da 4 a 6 cifre')
      return
    }
    if (changeNewPin !== changeNewPinConfirm) {
      setChangeError('I due PIN non coincidono')
      return
    }
    setChanging(true)
    setChangeError(null)
    try {
      const ok = await verifyPin(currentPinForChange)
      if (!ok) {
        setChangeError('PIN attuale errato')
        setChanging(false)
        return
      }
      await setPin(changeNewPin)
      toast.success('PIN aggiornato')
      resetChangeForm()
    } catch (error) {
      toast.error('Errore nell’aggiornamento del PIN', {
        description: error instanceof Error ? error.message : 'Riprova',
      })
    } finally {
      setChanging(false)
    }
  }

  const handleDisable = async () => {
    if (!disablePin) {
      setDisableError('Inserisci il PIN attuale')
      return
    }
    setDisabling(true)
    setDisableError(null)
    try {
      const ok = await disableLock(disablePin)
      if (!ok) {
        setDisableError('PIN errato')
        setDisabling(false)
        return
      }
      toast.success('Blocco con PIN disattivato')
      resetDisableForm()
    } catch (error) {
      toast.error('Errore nella disattivazione del blocco', {
        description: error instanceof Error ? error.message : 'Riprova',
      })
    } finally {
      setDisabling(false)
    }
  }

  const handleAutoLockChange = (value: string) => {
    const minutes = Number(value)
    setAutoLockMinutes(minutes)
    toast.success('Tempo di blocco automatico aggiornato')
  }

  return (
    <Card>
      <div className="flex items-center gap-2 mb-2">
        <Lock className="w-4 h-4 text-muted-foreground" strokeWidth={1.85} />
        <h2 className="font-display text-xl font-semibold tracking-tight">Blocco app</h2>
      </div>

      <div className="flex items-start gap-2 mb-5 text-sm text-muted-foreground leading-relaxed">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={1.85} />
        <p>
          Il PIN protegge l&apos;accesso all&apos;app su questo dispositivo. I dati
          restano protetti anche dalle credenziali del tuo account. Non si tratta di
          una cifratura dei dati: chi ha accesso diretto al dispositivo o al database
          può comunque raggiungerli.
        </p>
      </div>

      {!enabled ? (
        <div className="space-y-4">
          {!showEnableForm ? (
            <Button onClick={() => setShowEnableForm(true)} variant="secondary">
              <Lock className="w-4 h-4" strokeWidth={2} />
              Attiva blocco con PIN
            </Button>
          ) : (
            <div className="space-y-3 max-w-sm">
              <Input
                label="Nuovo PIN"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={newPin}
                onChange={(e) => setNewPin(sanitizeDigits(e.target.value))}
                hint="Da 4 a 6 cifre"
              />
              <Input
                label="Conferma PIN"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={newPinConfirm}
                onChange={(e) => setNewPinConfirm(sanitizeDigits(e.target.value))}
                error={enableError ?? undefined}
              />
              <div className="flex gap-2 pt-1">
                <Button onClick={handleEnable} loading={enabling} disabled={enabling}>
                  Attiva
                </Button>
                <Button variant="outline" onClick={resetEnableForm} disabled={enabling}>
                  Annulla
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-sm font-medium text-success">
            <ShieldCheck className="w-4 h-4" strokeWidth={2} />
            Blocco con PIN attivo
          </div>

          <div className="max-w-xs">
            <Select
              label="Blocca automaticamente dopo"
              value={String(autoLockMinutes)}
              onChange={(e) => handleAutoLockChange(e.target.value)}
              options={AUTO_LOCK_OPTIONS}
              hint="Tempo trascorso in background prima che l'app richieda di nuovo il PIN"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {!showChangeForm && (
              <Button
                variant="outline"
                onClick={() => {
                  resetDisableForm()
                  setShowChangeForm(true)
                }}
              >
                <KeyRound className="w-4 h-4" strokeWidth={2} />
                Cambia PIN
              </Button>
            )}
            {!showDisableForm && (
              <Button
                variant="destructive"
                onClick={() => {
                  resetChangeForm()
                  setShowDisableForm(true)
                }}
              >
                Disattiva
              </Button>
            )}
          </div>

          {showChangeForm && (
            <div className="space-y-3 max-w-sm border-t border-border pt-4">
              <Input
                label="PIN attuale"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={currentPinForChange}
                onChange={(e) => setCurrentPinForChange(sanitizeDigits(e.target.value))}
              />
              <Input
                label="Nuovo PIN"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={changeNewPin}
                onChange={(e) => setChangeNewPin(sanitizeDigits(e.target.value))}
                hint="Da 4 a 6 cifre"
              />
              <Input
                label="Conferma nuovo PIN"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={changeNewPinConfirm}
                onChange={(e) => setChangeNewPinConfirm(sanitizeDigits(e.target.value))}
                error={changeError ?? undefined}
              />
              <div className="flex gap-2 pt-1">
                <Button onClick={handleChangePin} loading={changing} disabled={changing}>
                  Salva nuovo PIN
                </Button>
                <Button variant="outline" onClick={resetChangeForm} disabled={changing}>
                  Annulla
                </Button>
              </div>
            </div>
          )}

          {showDisableForm && (
            <div className="space-y-3 max-w-sm border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">
                Inserisci il PIN attuale per disattivare il blocco.
              </p>
              <Input
                label="PIN attuale"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={disablePin}
                onChange={(e) => setDisablePin(sanitizeDigits(e.target.value))}
                error={disableError ?? undefined}
              />
              <div className="flex gap-2 pt-1">
                <Button
                  variant="destructive"
                  onClick={handleDisable}
                  loading={disabling}
                  disabled={disabling}
                >
                  Conferma disattivazione
                </Button>
                <Button variant="outline" onClick={resetDisableForm} disabled={disabling}>
                  Annulla
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
