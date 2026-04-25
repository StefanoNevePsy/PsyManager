import { Link } from 'react-router-dom'
import {
  Users,
  Calendar,
  CreditCard,
  TrendingUp,
  Clock,
  Plus,
  ChevronRight,
} from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { useAuth } from '@/hooks/useAuth'
import { Button, Card, EmptyState, PageHeader } from '@/components/ui'

export default function DashboardPage() {
  const { user } = useAuth()
  const { data, isLoading } = useDashboardStats()

  const greeting = (() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Buongiorno'
    if (hour < 18) return 'Buon pomeriggio'
    return 'Buonasera'
  })()

  const stats = [
    {
      title: 'Pazienti Attivi',
      value: data?.activePatients ?? 0,
      icon: Users,
      color: 'bg-blue-500/10 text-blue-500',
      link: '/patients',
    },
    {
      title: 'Sedute Questo Mese',
      value: data?.monthSessions ?? 0,
      icon: Calendar,
      color: 'bg-green-500/10 text-green-500',
      link: '/sessions',
    },
    {
      title: 'Incassi Mese',
      value: `€ ${(data?.monthIncome ?? 0).toFixed(2)}`,
      icon: CreditCard,
      color: 'bg-purple-500/10 text-purple-500',
      link: '/payments',
    },
    {
      title: 'Proiezione Anno',
      value: `€ ${(data?.yearProjection ?? 0).toFixed(2)}`,
      icon: TrendingUp,
      color: 'bg-orange-500/10 text-orange-500',
      link: '/reports',
    },
  ]

  return (
    <div className="p-4 md:p-8 space-y-6">
      <PageHeader
        title={`${greeting}!`}
        description={user?.email ? `Benvenuto, ${user.email.split('@')[0]}` : 'Benvenuto in PsyManager'}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Link key={stat.title} to={stat.link}>
              <Card hover>
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2 rounded-lg ${stat.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-xs md:text-sm text-muted-foreground mb-1 truncate">
                  {stat.title}
                </p>
                <p className="text-xl md:text-2xl font-bold text-foreground">
                  {isLoading ? '...' : stat.value}
                </p>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Today's sessions and recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">
              Sedute di Oggi
            </h2>
            <Link to="/sessions">
              <Button variant="ghost" size="sm">
                Vedi tutte <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>

          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">
              Caricamento...
            </p>
          ) : data?.todaySessions.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="Nessuna seduta oggi"
              description="Non ci sono sedute in programma oggi"
            />
          ) : (
            <div className="space-y-2">
              {data?.todaySessions.map((session) => (
                <div
                  key={session.id}
                  className="border border-border rounded-lg p-3 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="bg-primary/10 text-primary p-2 rounded-lg flex-shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">
                        {session.patientName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {session.serviceName}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold">
                      {format(new Date(session.scheduled_at), 'HH:mm')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {session.duration_minutes} min
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">
              Pagamenti Recenti
            </h2>
          </div>

          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">
              Caricamento...
            </p>
          ) : data?.recentPayments.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="Nessun pagamento"
              description="I pagamenti registrati appariranno qui"
            />
          ) : (
            <div className="space-y-3">
              {data?.recentPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between text-sm pb-3 border-b border-border last:border-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">
                      {payment.patientName || 'Pagamento generico'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(payment.payment_date), 'd MMM yyyy', {
                        locale: it,
                      })}
                    </p>
                  </div>
                  <p className="font-semibold text-green-600 dark:text-green-400 flex-shrink-0">
                    € {payment.amount.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Upcoming sessions */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            Prossime Sedute
          </h2>
          <Link to="/sessions">
            <Button variant="ghost" size="sm">
              Vedi calendario <ChevronRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <p className="text-center py-8 text-muted-foreground">
            Caricamento...
          </p>
        ) : data?.upcomingSessions.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="Nessuna seduta in programma"
            description="Aggiungi nuove sedute per organizzare la tua settimana"
            action={
              <Link to="/sessions">
                <Button>
                  <Plus className="w-4 h-4" />
                  Nuova Seduta
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data?.upcomingSessions.map((session) => (
              <div
                key={session.id}
                className="border border-border rounded-lg p-3"
              >
                <p className="text-xs text-muted-foreground mb-1">
                  {format(new Date(session.scheduled_at), "EEEE d MMM", {
                    locale: it,
                  })}
                </p>
                <p className="font-semibold text-sm mb-1">
                  {session.patientName}
                </p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {session.serviceName}
                  </span>
                  <span className="font-medium">
                    {format(new Date(session.scheduled_at), 'HH:mm')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
