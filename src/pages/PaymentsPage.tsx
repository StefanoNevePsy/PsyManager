import { Plus, Search } from 'lucide-react'
import { useState } from 'react'

export default function PaymentsPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'paid' | 'pending'>('all')

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Pagamenti</h1>
          <p className="text-muted-foreground">
            Gestisci i pagamenti dei tuoi pazienti
          </p>
        </div>
        <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90 flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Registra Pagamento
        </button>
      </div>

      <div className="bg-card rounded-lg border border-border p-6">
        <div className="mb-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Cerca pagamenti..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-input border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex gap-2">
            {(['all', 'paid', 'pending'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-4 py-2 rounded-lg transition-colors capitalize ${
                  filterType === type
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-foreground hover:bg-secondary/80'
                }`}
              >
                {type === 'all'
                  ? 'Tutti'
                  : type === 'paid'
                    ? 'Pagati'
                    : 'In Sospeso'}
              </button>
            ))}
          </div>
        </div>

        <table className="w-full text-sm">
          <thead className="border-b border-border">
            <tr className="text-muted-foreground">
              <th className="text-left py-3 px-4 font-medium">Paziente</th>
              <th className="text-left py-3 px-4 font-medium">Importo</th>
              <th className="text-left py-3 px-4 font-medium">Data</th>
              <th className="text-left py-3 px-4 font-medium">Stato</th>
              <th className="text-left py-3 px-4 font-medium">Azioni</th>
            </tr>
          </thead>
          <tbody>
            <tr className="text-foreground text-center py-12">
              <td colSpan={5} className="py-12">
                Nessun pagamento registrato
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
