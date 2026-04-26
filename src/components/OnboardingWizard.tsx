import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Briefcase, Calendar, ArrowRight, Sparkles, X, Check } from 'lucide-react'
import { Button, Modal } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { usePatients } from '@/hooks/usePatients'
import { useServiceTypes } from '@/hooks/useServiceTypes'

const STORAGE_KEY = 'psymanager:onboarding-dismissed'

interface Step {
  id: 'patient' | 'service' | 'session'
  icon: typeof Users
  title: string
  description: string
  cta: string
  href: string
}

const steps: Step[] = [
  {
    id: 'patient',
    icon: Users,
    title: 'Aggiungi il primo paziente',
    description: 'Inserisci nome, contatti e note. I dati restano sempre tuoi e si sincronizzano su tutti i dispositivi.',
    cta: 'Vai ai pazienti',
    href: '/patients',
  },
  {
    id: 'service',
    icon: Briefcase,
    title: 'Definisci una prestazione',
    description: 'Tariffa, durata, tipologia. Le prestazioni servono per pianificare le sedute e calcolare gli incassi.',
    cta: 'Crea prestazione',
    href: '/service-types',
  },
  {
    id: 'session',
    icon: Calendar,
    title: 'Pianifica una seduta',
    description: 'Collega paziente e prestazione, scegli data e ora. Puoi sincronizzarla su Google Calendar in un click.',
    cta: 'Apri agenda',
    href: '/sessions',
  },
]

export default function OnboardingWizard() {
  const { isAuthenticated, initialized } = useAuth()
  const { data: patients = [], isLoading: patientsLoading } = usePatients()
  const { data: services = [], isLoading: servicesLoading } = useServiceTypes()
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem(STORAGE_KEY) === '1'
  })

  const completed = {
    patient: patients.length > 0,
    service: services.length > 0,
    session: false,
  }

  // Auto-dismiss when user has at least one patient AND one service (close to onboarded)
  const allDone = completed.patient && completed.service

  useEffect(() => {
    if (allDone && !dismissed) {
      // Soft auto-dismiss when user has completed essentials
      const t = setTimeout(() => handleDismiss(), 600)
      return () => clearTimeout(t)
    }
  }, [allDone, dismissed])

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1')
    setDismissed(true)
  }

  // Don't show: not auth, not initialized, dismissed, or still loading
  if (!initialized || !isAuthenticated || dismissed || patientsLoading || servicesLoading) {
    return null
  }

  // If user already has patients and services, don't show
  if (allDone) return null

  const completedCount = Object.values(completed).filter(Boolean).length

  return (
    <Modal isOpen onClose={handleDismiss} size="lg">
      <div className="flex items-start gap-3 mb-1">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary-soft text-primary flex items-center justify-center">
          <Sparkles className="w-5 h-5" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-2xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">
            Benvenuto in PsyManager
          </p>
          <h2 className="font-display text-2xl font-semibold text-foreground tracking-tight leading-tight">
            Tre passi per iniziare
          </h2>
        </div>
        <button
          onClick={handleDismiss}
          aria-label="Chiudi guida"
          className="flex-shrink-0 -mt-1 p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed mt-3 mb-6 max-w-lg">
        Imposta l'essenziale per iniziare a tracciare la tua attività. Puoi rimandare e tornare qui dalle Impostazioni.
      </p>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-6">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out-quart"
            style={{ width: `${(completedCount / steps.length) * 100}%` }}
          />
        </div>
        <span className="text-xs font-medium text-muted-foreground tabular-nums">
          {completedCount}/{steps.length}
        </span>
      </div>

      <div className="space-y-2.5">
        {steps.map((step, idx) => {
          const isComplete = completed[step.id]
          const Icon = step.icon
          return (
            <div
              key={step.id}
              className={`flex items-start gap-4 p-4 rounded-lg border transition-all ${
                isComplete
                  ? 'border-success/30 bg-success-soft/40'
                  : 'border-border bg-card hover:border-foreground/10'
              }`}
            >
              <div
                className={`flex-shrink-0 w-9 h-9 rounded-md flex items-center justify-center font-display font-semibold ${
                  isComplete
                    ? 'bg-success text-success-foreground'
                    : 'bg-secondary text-foreground'
                }`}
              >
                {isComplete ? (
                  <Check className="w-4 h-4" strokeWidth={2.5} />
                ) : (
                  <span className="text-sm tabular-nums">{idx + 1}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-4 h-4 text-muted-foreground" strokeWidth={1.85} />
                  <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </div>
              {!isComplete && (
                <Link to={step.href} onClick={handleDismiss} className="flex-shrink-0">
                  <Button variant="subtle" size="sm">
                    {step.cta}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-6 flex items-center justify-end pt-4 border-t border-border">
        <button
          onClick={handleDismiss}
          className="text-sm text-muted-foreground hover:text-foreground font-medium transition-colors"
        >
          Imposterò più tardi
        </button>
      </div>
    </Modal>
  )
}
