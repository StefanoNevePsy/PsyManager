import { BarChart3, Download } from 'lucide-react'
import { useState } from 'react'

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState('month')
  const [reportType, setReportType] = useState('income')

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Report</h1>
          <p className="text-muted-foreground">
            Analisi dei tuoi guadagni e delle tue attività
          </p>
        </div>
        <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90 flex items-center gap-2">
          <Download className="w-5 h-5" />
          Esporta
        </button>
      </div>

      <div className="bg-card rounded-lg border border-border p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-card-foreground mb-2">
              Periodo
            </label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full px-4 py-2 bg-input border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="week">Questa Settimana</option>
              <option value="month">Questo Mese</option>
              <option value="quarter">Questo Trimestre</option>
              <option value="year">Questo Anno</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-card-foreground mb-2">
              Tipo di Report
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full px-4 py-2 bg-input border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="income">Guadagni</option>
              <option value="patients">Pazienti</option>
              <option value="sessions">Sedute</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <div className="text-center">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nessun dato disponibile per il periodo selezionato</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card rounded-lg border border-border p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Guadagni per Tipo di Prestazione
          </h2>
          <p className="text-muted-foreground text-center py-8">
            Nessun dato disponibile
          </p>
        </div>

        <div className="bg-card rounded-lg border border-border p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Andamento Mensile
          </h2>
          <p className="text-muted-foreground text-center py-8">
            Nessun dato disponibile
          </p>
        </div>
      </div>
    </div>
  )
}
