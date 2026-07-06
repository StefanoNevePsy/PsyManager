import { Database, PaymentMethod } from '@/types/database'

type TaxSettings = Database['public']['Tables']['tax_settings']['Row']

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Contanti',
  bank_transfer: 'Bonifico',
  credit_card: 'Carta',
  other: 'Altro',
  my_invoice: 'Fatturo io (rendo % al centro)',
  center_invoice: 'Fattura il centro (mi rende la %)',
}

export const DEFAULT_TAX_SETTINGS = {
  coefficiente_redditivita: 78,
  imposta_sostitutiva_pct: 5,
  enpap_pct: 10,
}

export interface TaxParams {
  coefficiente_redditivita: number
  imposta_sostitutiva_pct: number
  enpap_pct: number
}

/**
 * Effective tax+contribution rate on INVOICED revenue under the Italian
 * regime forfettario: taxable base = revenue × coefficiente di redditività,
 * on which both imposta sostitutiva and ENPAP apply.
 * E.g. 78% × (5% + 10%) = 11.7% of gross invoiced.
 *
 * NOTE: this is an ESTIMATE for planning, not accounting: it ignores ENPAP
 * minimums, maternità, deductions of paid contributions from the taxable
 * base, and the ATECO coefficient specifics. Good enough for projections.
 */
export const effectiveTaxRate = (t: TaxParams): number =>
  (t.coefficiente_redditivita / 100) *
  ((t.imposta_sostitutiva_pct + t.enpap_pct) / 100)

export interface NetBreakdown {
  gross: number
  /** Amount kept by / returned to the center */
  centerShare: number
  /** Portion of the gross that goes through MY invoicing (taxable) */
  invoicedByMe: number
  /** Estimated taxes + ENPAP on the invoiced portion */
  taxes: number
  net: number
}

/**
 * Estimated net for a given amount, payment method and center share.
 *
 * - cash            → no invoice considered: net = gross
 * - bank/card/other → I invoice the full amount: net = gross − taxes(gross)
 * - my_invoice      → I invoice the full amount and return center_percentage
 *                     to the center: net = gross − centerShare − taxes(gross)
 * - center_invoice  → the center invoices the client and pays me my share,
 *                     which I invoice to the center:
 *                     net = myShare − taxes(myShare)
 */
export const computeNet = (
  gross: number,
  method: PaymentMethod | null | undefined,
  centerPercentage: number,
  tax: TaxParams
): NetBreakdown => {
  const rate = effectiveTaxRate(tax)
  const cp = Math.min(100, Math.max(0, centerPercentage || 0)) / 100

  switch (method) {
    case 'cash': {
      return { gross, centerShare: 0, invoicedByMe: 0, taxes: 0, net: gross }
    }
    case 'my_invoice': {
      const centerShare = gross * cp
      const taxes = gross * rate
      return {
        gross,
        centerShare,
        invoicedByMe: gross,
        taxes,
        net: gross - centerShare - taxes,
      }
    }
    case 'center_invoice': {
      const centerShare = gross * cp
      const mine = gross - centerShare
      const taxes = mine * rate
      return { gross, centerShare, invoicedByMe: mine, taxes, net: mine - taxes }
    }
    // bank_transfer / credit_card / other / unknown → fully invoiced by me
    default: {
      const taxes = gross * rate
      return { gross, centerShare: 0, invoicedByMe: gross, taxes, net: gross - taxes }
    }
  }
}

/**
 * Net estimate for a SESSION that may not have a payment yet: uses the
 * service type's default payment method (fallback: fully invoiced by me,
 * the most conservative estimate).
 */
export const computeSessionNet = (
  price: number,
  serviceType: {
    center_percentage?: number | null
    default_payment_method?: PaymentMethod | null
  } | null,
  tax: TaxParams
): NetBreakdown =>
  computeNet(
    price,
    serviceType?.default_payment_method ?? 'other',
    serviceType?.center_percentage ?? 0,
    tax
  )

export type { TaxSettings }
