import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Mail, Lock, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

type Mode = 'login' | 'signup' | 'reset'

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
        if (password !== confirmPassword) {
          throw new Error('Le password non coincidono')
        }
        if (password.length < 8) {
          throw new Error('La password deve essere di almeno 8 caratteri')
        }
        const { error } = await signUp(email, password)
        if (error) throw error
        setSuccess(
          'Registrazione effettuata! Controlla la tua email per confermare l\'account.'
        )
      } else if (mode === 'reset') {
        const { error } = await resetPassword(email)
        if (error) throw error
        setSuccess('Email di recupero inviata! Controlla la tua casella.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto')
    } finally {
      setLoading(false)
    }
  }

  const titles = {
    login: 'Accedi',
    signup: 'Registrati',
    reset: 'Recupera Password',
  }

  const buttons = {
    login: loading ? 'Accesso in corso...' : 'Accedi',
    signup: loading ? 'Registrazione in corso...' : 'Registrati',
    reset: loading ? 'Invio email...' : 'Invia email',
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card rounded-lg shadow-xl p-8">
        {mode !== 'login' && (
          <button
            onClick={() => {
              setMode('login')
              setError('')
              setSuccess('')
            }}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Torna al login
          </button>
        )}

        <h1 className="text-3xl font-bold text-center mb-2 text-card-foreground">
          PsyManager
        </h1>
        <p className="text-center text-muted-foreground mb-8">{titles[mode]}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-card-foreground mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-10 pr-4 py-2 bg-input border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                required
                autoComplete="email"
              />
            </div>
          </div>

          {mode !== 'reset' && (
            <div>
              <label className="block text-sm font-medium text-card-foreground mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2 bg-input border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={8}
                />
              </div>
            </div>
          )}

          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-card-foreground mb-2">
                Conferma Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2 bg-input border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                  autoComplete="new-password"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="bg-destructive/20 text-destructive p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-500/20 text-green-600 p-3 rounded-lg text-sm">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground py-2 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {buttons[mode]}
          </button>
        </form>

        <div className="mt-6 space-y-2 text-center text-sm">
          {mode === 'login' && (
            <>
              <p className="text-muted-foreground">
                Non hai un account?{' '}
                <button
                  onClick={() => {
                    setMode('signup')
                    setError('')
                  }}
                  className="text-primary hover:underline font-medium"
                >
                  Registrati
                </button>
              </p>
              <p className="text-muted-foreground">
                <button
                  onClick={() => {
                    setMode('reset')
                    setError('')
                  }}
                  className="text-primary hover:underline"
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
                onClick={() => {
                  setMode('login')
                  setError('')
                }}
                className="text-primary hover:underline font-medium"
              >
                Accedi
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
