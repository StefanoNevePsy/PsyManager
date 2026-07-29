import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui'
import { Database } from '@/types/database'
import { PAYMENT_METHOD_LABELS } from '@/lib/netIncome'
import { ReceiptWithRelations } from '@/hooks/useReceipts'

type ReceiptSettings = Database['public']['Tables']['receipt_settings']['Row']

const eur = (n: number) =>
  n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface Props {
  receipt: ReceiptWithRelations
  settings: ReceiptSettings | null | undefined
}

/**
 * Printable "ricevuta sanitaria" document. Meant to be rendered inside a
 * preview Modal: on screen it looks like an A4 sheet in a card, and
 * `window.print()` — driven by the "Stampa / Salva PDF" button — uses the
 * `@media print` rules below to hide everything else on the page so only
 * `.receipt-print` (and its children) end up on paper / in the PDF.
 */
export default function ReceiptPrintView({ receipt, settings }: Props) {
  const total = Number(receipt.amount) + Number(receipt.bollo_amount || 0)

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .receipt-print, .receipt-print * { visibility: visible; }
          .receipt-print {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            margin: 0;
            padding: 20mm 18mm;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="flex justify-end mb-4 no-print">
        <Button onClick={() => window.print()}>
          <Printer className="w-4 h-4" strokeWidth={2.25} />
          Stampa / Salva PDF
        </Button>
      </div>

      <div className="receipt-print bg-white text-black mx-auto max-w-[210mm] p-10 border border-border rounded-lg shadow-soft text-sm leading-relaxed">
        {/* Header: professional data */}
        <header className="border-b-2 border-black/80 pb-4 mb-6">
          <h1 className="text-xl font-bold tracking-tight">
            {settings?.professional_name || '—'}
          </h1>
          <div className="text-xs mt-1 space-y-0.5 text-black/80">
            {settings?.address && <p>{settings.address}</p>}
            <p>
              {settings?.tax_code && <span>C.F. {settings.tax_code}</span>}
              {settings?.tax_code && settings?.vat_number && <span> — </span>}
              {settings?.vat_number && <span>P.IVA {settings.vat_number}</span>}
            </p>
            {settings?.albo_registration && <p>{settings.albo_registration}</p>}
          </div>
        </header>

        {/* Title + recipient */}
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <h2 className="text-lg font-bold">
              Ricevuta n. {receipt.number}/{receipt.year}
            </h2>
            <p className="text-xs mt-1">
              Data emissione: {format(new Date(receipt.issue_date), 'd MMMM yyyy', { locale: it })}
            </p>
          </div>
          <div className="text-right text-xs">
            <p className="font-semibold uppercase tracking-wider text-black/60 mb-1">Destinatario</p>
            <p className="font-medium text-sm">{receipt.recipient_name}</p>
            {receipt.recipient_tax_code && <p>C.F. {receipt.recipient_tax_code}</p>}
            {receipt.recipient_address && <p>{receipt.recipient_address}</p>}
          </div>
        </div>

        {/* Body */}
        <table className="w-full border-collapse mb-6">
          <thead>
            <tr className="border-b border-black/40 text-left text-xs uppercase tracking-wider text-black/60">
              <th className="py-2">Descrizione</th>
              <th className="py-2 text-right">Importo</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-black/10">
              <td className="py-2">{receipt.description}</td>
              <td className="py-2 text-right tabular-nums">€ {eur(Number(receipt.amount))}</td>
            </tr>
            {Number(receipt.bollo_amount) > 0 && (
              <tr className="border-b border-black/10">
                <td className="py-2">
                  Marca da bollo € {eur(Number(receipt.bollo_amount))} assolta sull'originale
                </td>
                <td className="py-2 text-right tabular-nums">
                  € {eur(Number(receipt.bollo_amount))}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td className="pt-3 font-bold">Totale</td>
              <td className="pt-3 text-right font-bold tabular-nums">€ {eur(total)}</td>
            </tr>
          </tfoot>
        </table>

        {receipt.payment_method && (
          <p className="text-xs mb-6">
            Metodo di pagamento: {PAYMENT_METHOD_LABELS[receipt.payment_method] || receipt.payment_method}
          </p>
        )}

        {/* Footer: fiscal notes + signature */}
        <div className="mt-10 pt-4 border-t border-black/20 text-xs text-black/70 space-y-2">
          {settings?.exempt_note && <p>{settings.exempt_note}</p>}
          {settings?.regime_note && <p>{settings.regime_note}</p>}
        </div>

        <div className="mt-16 flex justify-end">
          <div className="text-center">
            <div className="w-48 border-t border-black/60 pt-1 text-xs">
              Firma del professionista
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
