import { useState, useMemo } from 'react'
import { Download, BarChart3, TrendingUp, Users, Briefcase } from 'lucide-react'
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
} from 'date-fns'
import { useReports, exportToCSV } from '@/hooks/useReports'
import { Button, Card, EmptyState, PageHeader, Select, Skeleton, useToast } from '@/components/ui'

type Period = 'week' | 'month' | 'quarter' | 'year'

const eur = (n: number) =>
  n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function ReportsPage() {
  const { toast } = useToast()
  const [period, setPeriod] = useState<Period>('month')

  const { startDate, endDate, label } = useMemo(() => {
    const now = new Date()
    switch (period) {
      case 'week':
        return {
          startDate: startOfWeek(now, { weekStartsOn: 1 }),
          endDate: endOfWeek(now, { weekStartsOn: 1 }),
          label: 'Questa settimana',
        }
      case 'month':
        return {
          startDate: startOfMonth(now),
          endDate: endOfMonth(now),
          label: 'Questo mese',
        }
      case 'quarter':
        return {
          startDate: startOfQuarter(now),
          endDate: endOfQuarter(now),
          label: 'Questo trimestre',
        }
      case 'year':
        return {
          startDate: startOfYear(now),
          endDate: endOfYear(now),
          label: "Quest'anno",
        }
    }
  }, [period])

  const { data, isLoading } = useReports(startDate, endDate)

  const handleExport = () => {
    if (!data) return
    try {
      const dateStr = new Date().toISOString().split('T')[0]
      exportToCSV(data, `psymanager_report_${period}_${dateStr}.csv`)
      toast.success('Report esportato', { description: `psymanager_report_${period}_${dateStr}.csv` })
    } catch (error) {
      toast.error('Esportazione fallita', {
        description: error instanceof Error ? error.message : 'Riprova',
      })
    }
  }

  const maxMonthlyIncome = useMemo(() => {
    if (!data?.monthlyTrend.length) return 1
    return Math.max(...data.monthlyTrend.map((m) => m.income), 1)
  }, [data])

  return (
    <div className="px-4 md:px-10 py-8 md:py-12 space-y-8 max-w-[1400px] mx-auto">
      <PageHeader
        eyebrow="Analisi"
        title="Report"
        description="Andamento incassi, sedute e attività clinica per periodo. Esporta i dati in CSV per la contabilità."
        action={
          <Button onClick={handleExport} disabled={!data} variant="outline">
            <Download className="w-4 h-4" strokeWidth={2} />
            Esporta CSV
          </Button>
        }
      />

      <Card padding="md">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <Select
            label="Periodo"
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            options={[
              { value: 'week', label: 'Questa settimana' },
              { value: 'month', label: 'Questo mese' },
              { value: 'quarter', label: 'Questo trimestre' },
              { value: 'year', label: "Quest'anno" },
            ]}
          />

          <div>
            <p className="text-2xs uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
              {label} · Incasso
            </p>
            {isLoading ? (
              <Skeleton className="h-9 w-32 bg-muted" />
            ) : (
              <p className="font-display text-3xl font-semibold tabular-nums tracking-tight">
                <span className="text-base font-normal text-muted-foreground mr-1">€</span>
                {eur(data?.totalIncome ?? 0)}
              </p>
            )}
          </div>

          <div>
            <p className="text-2xs uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
              {label} · Sedute
            </p>
            {isLoading ? (
              <Skeleton className="h-9 w-16 bg-muted" />
            ) : (
              <p className="font-display text-3xl font-semibold tabular-nums tracking-tight">
                {data?.totalSessions ?? 0}
              </p>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-2 mb-5">
          <TrendingUp className="w-4 h-4 text-muted-foreground" strokeWidth={1.85} />
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Andamento ultimi 6 mesi
          </h2>
        </div>

        {isLoading || !data ? (
          <div className="space-y-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-8 w-full bg-muted" />
            ))}
          </div>
        ) : data.monthlyTrend.every((m) => m.income === 0 && m.sessions === 0) ? (
          <EmptyState
            icon={BarChart3}
            title="Nessun dato"
            description="Non ci sono dati per visualizzare il trend."
          />
        ) : (
          <ul className="space-y-4">
            {data.monthlyTrend.map((m) => (
              <li key={m.month} className="space-y-1.5">
                <div className="flex justify-between items-baseline text-sm">
                  <span className="capitalize font-medium text-foreground">{m.month}</span>
                  <span className="font-semibold tabular-nums text-foreground">
                    € {eur(m.income)}
                    <span className="text-xs text-muted-foreground ml-2 font-normal">
                      {m.sessions} sedute
                    </span>
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500 ease-out-quart"
                    style={{ width: `${(m.income / maxMonthlyIncome) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center gap-2 mb-5">
            <Briefcase className="w-4 h-4 text-muted-foreground" strokeWidth={1.85} />
            <h2 className="font-display text-xl font-semibold tracking-tight">
              Per tipo di prestazione
            </h2>
          </div>

          {isLoading || !data ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full bg-muted" />
              ))}
            </div>
          ) : data.byServiceType.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              size="sm"
              title="Nessun dato"
              description="Non ci sono sedute nel periodo."
            />
          ) : (
            <ul className="space-y-2">
              {data.byServiceType.map((item) => (
                <li
                  key={item.name}
                  className="flex items-center justify-between p-3 rounded-md hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className={`text-2xs uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${
                          item.type === 'private'
                            ? 'bg-muted text-muted-foreground'
                            : 'bg-primary-soft text-primary'
                        }`}
                      >
                        {item.type === 'private' ? 'Privato' : 'Pacchetto'}
                      </span>
                      <p className="font-medium text-sm text-foreground truncate">{item.name}</p>
                    </div>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {item.count} sedute
                    </p>
                  </div>
                  <p className="font-semibold tabular-nums text-foreground flex-shrink-0 ml-2">
                    € {eur(item.income)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-5">
            <Users className="w-4 h-4 text-muted-foreground" strokeWidth={1.85} />
            <h2 className="font-display text-xl font-semibold tracking-tight">Per paziente</h2>
          </div>

          {isLoading || !data ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full bg-muted" />
              ))}
            </div>
          ) : data.byPatient.length === 0 ? (
            <EmptyState
              icon={Users}
              size="sm"
              title="Nessun dato"
              description="Non ci sono sedute nel periodo."
            />
          ) : (
            <ul className="space-y-2 max-h-96 overflow-y-auto">
              {data.byPatient.map((item) => (
                <li
                  key={item.name}
                  className="flex items-center justify-between p-3 rounded-md hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {item.sessionsCount} sedute
                    </p>
                  </div>
                  <p className="font-semibold tabular-nums text-foreground flex-shrink-0 ml-2">
                    € {eur(item.income)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
