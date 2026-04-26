import { Link } from 'react-router-dom'
import {
  Users,
  Calendar,
  CreditCard,
  TrendingUp,
  Clock,
  Plus,
  ArrowUpRight,
  AlertCircle,
} from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { useAuth } from '@/hooks/useAuth'
import { useUserProfile } from '@/hooks/useUserProfile'
import { Button, Card, EmptyState, Skeleton } from '@/components/ui'

export default function DashboardPage() {
  const { user } = useAuth()
  const { profile } = useUserProfile()
  const { data, isLoading } = useDashboardStats()

  const today = new Date()
  const greeting = (() => {
    const hour = today.getHours()
    if (hour < 12) return 'Buongiorno'
    if (hour < 18) return 'Buon pomeriggio'
    return 'Buonasera'
  })()

  const username = profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || ''
  const todayLabel = format(today, "EEEE d MMMM", { locale: it })

  const stats = [
    {
      title: 'Pazienti attivi',
      value: data?.activePatients ?? 0,
      icon: Users,
      link: '/patients',
      hint: data?.activePatients === 1 ? 'paziente in carico' : 'pazienti in carico',
    },
    {
      title: 'Sedute questo mese',
      value: data?.monthSessions ?? 0,
      icon: Calendar,
      link: '/sessions',
      hint: 'totali nel mese corrente',
    },
    {
      title: 'Incassi mese',
      value: `€ ${(data?.monthIncome ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: CreditCard,
      link: '/payments',
      hint: 'pagamenti registrati',
    },
    {
      title: 'Proiezione anno',
      value: `€ ${(data?.yearProjection ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      icon: TrendingUp,
      link: '/reports',
      hint: 'stima su base mensile',
    },
  ]

  return (
    <div className="px-4 md:px-10 py-8 md:py-12 space-y-10 max-w-[1400px] mx-auto">
      {/* Greeting */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div className="min-w-0">
          <p className="text-2xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
            {todayLabel}
          </p>
          <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
            {greeting},{' '}
            <span className="italic font-display-soft text-primary">{username}</span>.
          </h1>
        </div>
        <Link to="/sessions" className="hidden md:inline-flex">
          <Button variant="primary" size="md">
            <Plus className="w-4 h-4" strokeWidth={2.25} />
            Nuova seduta
          </Button>
        </Link>
      </div>

      {/* Stats — restrained: monochrome icons + accent on primary metric only */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border rounded-lg overflow-hidden border border-border">
        {stats.map((stat, i) => {
          const Icon = stat.icon
          const isPrimary = i === 0
          return (
            <Link
              key={stat.title}
              to={stat.link}
              className="group bg-card p-5 lg:p-6 hover:bg-secondary/30 transition-colors duration-200 ease-out-quart relative"
            >
              <div className="flex items-start justify-between mb-4">
                <Icon
                  className={`w-[18px] h-[18px] ${isPrimary ? 'text-primary' : 'text-muted-foreground'}`}
                  strokeWidth={1.85}
                />
                <ArrowUpRight
                  className="w-4 h-4 text-muted-foreground/40 group-hover:text-foreground transition-colors"
                  strokeWidth={1.85}
                />
              </div>
              <p className="text-xs text-muted-foreground mb-1.5 truncate">{stat.title}</p>
              {isLoading ? (
                <Skeleton className="h-9 w-24 bg-muted" />
              ) : (
                <p className="font-display text-3xl lg:text-4xl font-semibold tracking-tight tabular-nums leading-none">
                  {stat.value}
                </p>
              )}
              <p className="text-2xs text-muted-foreground mt-2">{stat.hint}</p>
            </Link>
          )
        })}
      </div>

      {/* Today's sessions + Recent payments */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2" padding="none">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
                Sedute di oggi
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {data?.todaySessions.length || 0}{' '}
                {data?.todaySessions.length === 1 ? 'appuntamento' : 'appuntamenti'} in agenda
              </p>
            </div>
            <Link to="/sessions">
              <Button variant="ghost" size="sm">
                Apri agenda
                <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2} />
              </Button>
            </Link>
          </div>

          {isLoading ? (
            <div className="px-5 pb-5 space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-14 w-full bg-muted" />
              ))}
            </div>
          ) : data?.todaySessions.length === 0 ? (
            <EmptyState
              icon={Calendar}
              size="md"
              tone="neutral"
              title="Nessuna seduta oggi"
              description="Una giornata libera. Goditi la pausa o pianifica nuove sedute."
            />
          ) : (
            <ul className="divide-y divide-border">
              {data?.todaySessions.map((session) => (
                <li
                  key={session.id}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex-shrink-0 w-9 h-9 rounded-md bg-primary-soft text-primary flex items-center justify-center">
                    <Clock className="w-4 h-4" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-foreground truncate">
                      {session.patientName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {session.serviceName}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold tabular-nums text-foreground">
                      {format(new Date(session.scheduled_at), 'HH:mm')}
                    </p>
                    <p className="text-2xs text-muted-foreground tabular-nums">
                      {session.duration_minutes} min
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card padding="none">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
              Pagamenti recenti
            </h2>
            <Link to="/payments">
              <Button variant="ghost" size="sm" aria-label="Vedi tutti i pagamenti">
                <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2} />
              </Button>
            </Link>
          </div>

          {isLoading ? (
            <div className="px-5 pb-5 space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full bg-muted" />
              ))}
            </div>
          ) : data?.recentPayments.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              size="sm"
              title="Nessun pagamento"
              description="I pagamenti registrati appariranno qui."
            />
          ) : (
            <ul className="divide-y divide-border">
              {data?.recentPayments.map((payment) => (
                <li
                  key={payment.id}
                  className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-secondary/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {payment.patientName || 'Pagamento generico'}
                    </p>
                    <p className="text-2xs text-muted-foreground tabular-nums">
                      {format(new Date(payment.payment_date), 'd MMM yyyy', { locale: it })}
                    </p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums text-success flex-shrink-0">
                    € {payment.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Upcoming sessions */}
      <section>
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
              Prossime sedute
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Pianificate nei prossimi giorni
            </p>
          </div>
          <Link to="/sessions" className="hidden sm:inline-flex">
            <Button variant="ghost" size="sm">
              Vedi tutte
              <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2} />
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 w-full bg-muted" />
            ))}
          </div>
        ) : data?.upcomingSessions.length === 0 ? (
          <Card variant="quiet">
            <EmptyState
              icon={Calendar}
              tone="primary"
              title="Nessuna seduta in programma"
              description="Aggiungi nuove sedute per organizzare la tua settimana."
              action={
                <Link to="/sessions">
                  <Button>
                    <Plus className="w-4 h-4" strokeWidth={2.25} />
                    Nuova seduta
                  </Button>
                </Link>
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data?.upcomingSessions.map((session) => (
              <Link
                key={session.id}
                to="/sessions"
                className="block bg-card border border-border rounded-lg p-4 hover:border-foreground/15 hover:shadow-soft transition-all duration-200 ease-out-quart group"
              >
                <p className="text-2xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                  {format(new Date(session.scheduled_at), 'EEEE d MMM', { locale: it })}
                </p>
                <p className="font-medium text-sm text-foreground mb-3 truncate">
                  {session.patientName}
                </p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground truncate min-w-0">
                    {session.serviceName}
                  </span>
                  <span className="font-semibold tabular-nums text-foreground flex-shrink-0 ml-2">
                    {format(new Date(session.scheduled_at), 'HH:mm')}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Arrears reminder — pain point hook from PRODUCT.md */}
      {data && data.recentPayments.length === 0 && data.activePatients > 0 && (
        <Card variant="quiet" className="border-warning/20 bg-warning-soft/30">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" strokeWidth={2} />
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-sm text-foreground">
                Tieni traccia degli arretrati
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Registra i pagamenti per mantenere chiari saldi e crediti dei tuoi pazienti.
              </p>
            </div>
            <Link to="/payments">
              <Button variant="outline" size="sm">
                Vai ai pagamenti
              </Button>
            </Link>
          </div>
        </Card>
      )}
    </div>
  )
}
