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
import { Button, Card, EmptyState, PageHeader, Select } from '@/components/ui'

type Period = 'week' | 'month' | 'quarter' | 'year'

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>('month')

  const { startDate, endDate, label } = useMemo(() => {
    const now = new Date()
    switch (period) {
      case 'week':
        return {
          startDate: startOfWeek(now, { weekStartsOn: 1 }),
          endDate: endOfWeek(now, { weekStartsOn: 1 }),
          label: 'Questa Settimana',
        }
      case 'month':
        return {
          startDate: startOfMonth(now),
          endDate: endOfMonth(now),
          label: 'Questo Mese',
        }
      case 'quarter':
        return {
          startDate: startOfQuarter(now),
          endDate: endOfQuarter(now),
          label: 'Questo Trimestre',
        }
      case 'year':
        return {
          startDate: startOfYear(now),
          endDate: endOfYear(now),
          label: 'Questo Anno',
        }
    }
  }, [period])

  const { data, isLoading } = useReports(startDate, endDate)

  const handleExport = () => {
    if (!data) return
    const dateStr = new Date().toISOString().split('T')[0]
    exportToCSV(data, `psymanager_report_${period}_${dateStr}.csv`)
  }

  const maxMonthlyIncome = useMemo(() => {
    if (!data?.monthlyTrend.length) return 1
    return Math.max(...data.monthlyTrend.map((m) => m.income), 1)
  }, [data])

  return (
    <div className="p-4 md:p-8 space-y-6">
      <PageHeader
        title="Report"
        description="Analizza i tuoi guadagni e le tue attività"
        action={
          <Button onClick={handleExport} disabled={!data}>
            <Download className="w-4 h-4" />
            Esporta CSV
          </Button>
        }
      />

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Select
            label="Periodo"
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            options={[
              { value: 'week', label: 'Questa Settimana' },
              { value: 'month', label: 'Questo Mese' },
              { value: 'quarter', label: 'Questo Trimestre' },
              { value: 'year', label: 'Questo Anno' },
            ]}
          />
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-secondary/50 rounded-lg p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold text-foreground mt-1">
              € {(data?.totalIncome ?? 0).toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Totale incassato</p>
          </div>
          <div className="bg-secondary/50 rounded-lg p-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold text-foreground mt-1">
              {data?.totalSessions ?? 0}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Sedute totali</p>
          </div>
        </div>
      </Card>

      {/* Monthly Trend */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">
            Andamento Ultimi 6 Mesi
          </h2>
        </div>

        {isLoading || !data ? (
          <p className="text-center py-8 text-muted-foreground">Caricamento...</p>
        ) : data.monthlyTrend.every((m) => m.income === 0 && m.sessions === 0) ? (
          <EmptyState
            icon={BarChart3}
            title="Nessun dato"
            description="Non ci sono dati per visualizzare il trend"
          />
        ) : (
          <div className="space-y-3">
            {data.monthlyTrend.map((m) => (
              <div key={m.month} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="capitalize text-foreground">{m.month}</span>
                  <span className="font-semibold text-foreground">
                    € {m.income.toFixed(2)}
                    <span className="text-xs text-muted-foreground ml-2">
                      ({m.sessions} sedute)
                    </span>
                  </span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: `${(m.income / maxMonthlyIncome) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* By Service Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Briefcase className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">
              Per Tipo di Prestazione
            </h2>
          </div>

          {isLoading || !data ? (
            <p className="text-center py-8 text-muted-foreground">
              Caricamento...
            </p>
          ) : data.byServiceType.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="Nessun dato"
              description="Non ci sono sedute nel periodo"
            />
          ) : (
            <div className="space-y-2">
              {data.byServiceType.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          item.type === 'private'
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                            : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                        }`}
                      >
                        {item.type === 'private' ? 'Privato' : 'Pacchetto'}
                      </span>
                      <p className="font-medium text-foreground truncate">
                        {item.name}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.count} sedute
                    </p>
                  </div>
                  <p className="font-semibold text-foreground flex-shrink-0">
                    € {item.income.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* By Patient */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">
              Per Paziente
            </h2>
          </div>

          {isLoading || !data ? (
            <p className="text-center py-8 text-muted-foreground">
              Caricamento...
            </p>
          ) : data.byPatient.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nessun dato"
              description="Non ci sono sedute nel periodo"
            />
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {data.byPatient.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.sessionsCount} sedute
                    </p>
                  </div>
                  <p className="font-semibold text-foreground flex-shrink-0">
                    € {item.income.toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
