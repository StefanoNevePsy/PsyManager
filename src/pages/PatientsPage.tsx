import { Plus, Search } from 'lucide-react'
import { useState } from 'react'

export default function PatientsPage() {
  const [searchTerm, setSearchTerm] = useState('')

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Pazienti</h1>
          <p className="text-muted-foreground">
            Gestisci l'anagrafe dei tuoi pazienti
          </p>
        </div>
        <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90 flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Nuovo Paziente
        </button>
      </div>

      <div className="bg-card rounded-lg border border-border p-6">
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Cerca pazienti..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-input border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <table className="w-full text-sm">
          <thead className="border-b border-border">
            <tr className="text-muted-foreground">
              <th className="text-left py-3 px-4 font-medium">Nome</th>
              <th className="text-left py-3 px-4 font-medium">Email</th>
              <th className="text-left py-3 px-4 font-medium">Telefono</th>
              <th className="text-left py-3 px-4 font-medium">Azioni</th>
            </tr>
          </thead>
          <tbody>
            <tr className="text-foreground text-center py-12">
              <td colSpan={4} className="py-12">
                Nessun paziente registrato
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
