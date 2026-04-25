import { BarChart3, Users, Calendar, CreditCard, TrendingUp } from 'lucide-react'

export default function DashboardPage() {
  const stats = [
    {
      title: 'Pazienti Attivi',
      value: '0',
      icon: Users,
      color: 'bg-blue-500/10 text-blue-500',
    },
    {
      title: 'Sedute Questo Mese',
      value: '0',
      icon: Calendar,
      color: 'bg-green-500/10 text-green-500',
    },
    {
      title: 'Incassi Mese',
      value: '€0',
      icon: CreditCard,
      color: 'bg-purple-500/10 text-purple-500',
    },
    {
      title: 'Proiezione Anno',
      value: '€0',
      icon: TrendingUp,
      color: 'bg-orange-500/10 text-orange-500',
    },
  ]

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Benvenuto in PsyManager
        </h1>
        <p className="text-muted-foreground">
          Gestisci le tue terapie e i tuoi guadagni in un unico posto
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.title} className="bg-card rounded-lg border border-border p-6">
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
              <p className="text-muted-foreground text-sm mb-1">{stat.title}</p>
              <p className="text-3xl font-bold text-foreground">{stat.value}</p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card rounded-lg border border-border p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">Sedute Prossime</h2>
          <p className="text-muted-foreground text-center py-12">
            Nessuna seduta programmata
          </p>
        </div>

        <div className="bg-card rounded-lg border border-border p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Attività Recente
          </h2>
          <p className="text-muted-foreground text-center py-12">
            Nessuna attività registrata
          </p>
        </div>
      </div>
    </div>
  )
}
