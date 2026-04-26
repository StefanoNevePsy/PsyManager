import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Mail, Lock, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Button, Input } from '@/components/ui'

type Mode = 'login' | 'signup' | 'reset'

const titles: Record<Mode, { eyebrow: string; heading: string; sub: string }> = {
  login: {
    eyebrow: 'Bentornato',
    heading: 'Accedi al tuo studio',
    sub: 'Continua a gestire pazienti, sedute e pagamenti.',
  },
  signup: {
    eyebrow: 'Inizia',
    heading: 'Crea il tuo account',
    sub: 'Pochi secondi per iniziare. I tuoi dati restano sempre tuoi.',
  },
  reset: {
    eyebrow: 'Recupero',
    heading: 'Recupera la password',
    sub: 'Ti inviamo un link per reimpostarla via email.',
  },
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn, signUp, resetPassword, isAuthenticated, initialized } = useAuth()

  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const from = (location.state as { from?: Location })?.from?.pathname || '/'

  useEffect(() => {
    if (initialized && isAuthenticated) {
      navigate(from, { replace: true })
    }
  }, [initialized, isAuthenticated, navigate, from])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password)
        if (error) throw error
        navigate(from, { replace: true })
      } else if (mode === 'signup') {
        if (password !== confirmPassword) throw new Error('Le password non coincidono')
        if (password.length < 8) throw new Error('La password deve essere di almeno 8 caratteri')
        const { error } = await signUp(email, password)
        if (error) throw error
        setSuccess("Registrazione effettuata. Controlla la tua email per confermare l'account.")
      } else if (mode === 'reset') {
        const { error } = await resetPassword(email)
        if (error) throw error
        setSuccess('Email di recupero inviata. Controlla la tua casella.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto')
    } finally {
      setLoading(false)
    }
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setError('')
    setSuccess('')
  }

  const submitText = {
    login: loading ? 'Accesso in corso...' : 'Accedi',
    signup: loading ? 'Creazione account...' : 'Crea account',
    reset: loading ? 'Invio email...' : 'Invia link',
  }[mode]

  const t = titles[mode]

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Left: form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          {/* Brand */}
          <div className="flex items-center gap-2.5 mb-12">
            <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-display text-xl font-bold">
              ψ
            </div>
            <span className="font-display text-xl font-semibold tracking-tight">PsyManager</span>
          </div>

          {mode !== 'login' && (
            <button
              onClick={() => switchMode('login')}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 -ml-1"
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={1.85} />
              Torna al login
            </button>
          )}

          <p className="text-2xs uppercase tracking-wider text-primary font-semibold mb-3">
            {t.eyebrow}
          </p>
          <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight mb-3">
            {t.heading}
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed mb-8">{t.sub}</p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@esempio.it"
              icon={<Mail className="w-4 h-4" strokeWidth={1.85} />}
              required
              autoComplete="email"
            />

            {mode !== 'reset' && (
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
                icon={<Lock className="w-4 h-4" strokeWidth={1.85} />}
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={8}
                hint={mode === 'signup' ? 'Almeno 8 caratteri' : undefined}
              />
            )}

            {mode === 'signup' && (
              <Input
                label="Conferma password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="********"
                icon={<Lock className="w-4 h-4" strokeWidth={1.85} />}
                required
                autoComplete="new-password"
              />
            )}

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive-soft border border-destructive/20 text-destructive"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={2.25} />
                <p className="text-sm leading-snug">{error}</p>
              </div>
            )}

            {success && (
              <div
                role="status"
                className="flex items-start gap-2.5 p-3 rounded-lg bg-success-soft border border-success/20 text-success"
              >
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={2.25} />
                <p className="text-sm leading-snug">{success}</p>
              </div>
            )}

            <Button type="submit" loading={loading} className="w-full" size="lg">
              {submitText}
            </Button>
          </form>

          <div className="mt-8 space-y-3 text-sm">
            {mode === 'login' && (
              <>
                <p className="text-muted-foreground">
                  Non hai un account?{' '}
                  <button
                    onClick={() => switchMode('signup')}
                    className="text-primary hover:underline underline-offset-2 font-medium"
                  >
                    Registrati
                  </button>
                </p>
                <p>
                  <button
                    onClick={() => switchMode('reset')}
                    className="text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors"
                  >
                    Password dimenticata?
                  </button>
                </p>
              </>
            )}
            {mode === 'signup' && (
              <p className="text-muted-foreground">
                Hai già un account?{' '}
                <button
                  onClick={() => switchMode('login')}
                  className="text-primary hover:underline underline-offset-2 font-medium"
                >
                  Accedi
                </button>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Right: editorial panel */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden border-l border-border bg-card items-center">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-dot-pattern opacity-40"
        />
        <div
          aria-hidden="true"
          className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-primary/5 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-20 -left-20 w-96 h-96 rounded-full bg-primary/5 blur-3xl"
        />

        <div className="relative max-w-md mx-auto px-12">
          <p className="text-2xs uppercase tracking-wider text-primary font-semibold mb-4">
            Il gestionale per terapeuti
          </p>
          <p className="font-display text-4xl font-medium leading-[1.15] tracking-tight text-foreground">
            <span className="italic font-display-soft">Cura</span> la tua pratica
            <br />
            quanto curi i tuoi <span className="italic font-display-soft">pazienti</span>.
          </p>
          <p className="text-base text-muted-foreground mt-6 leading-relaxed">
            Pazienti, sedute, pagamenti e Google Calendar in un'unica app sincronizzata, gratuita e tua.
          </p>

          <ul className="mt-10 space-y-3">
            {[
              'Sincronizzazione su tutti i tuoi dispositivi',
              'Tracking di arretrati e crediti pazienti',
              'Integrazione bidirezionale con Google Calendar',
              'I dati restano tuoi: nessun tracking, nessuna vendita',
            ].map((line) => (
              <li key={line} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <CheckCircle2
                  className="w-4 h-4 mt-0.5 flex-shrink-0 text-success"
                  strokeWidth={2.25}
                />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
