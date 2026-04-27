import { Tooltip } from '@/components/ui'

interface Props {
  /** Positive = patient owes money (debit). Negative = credit. */
  balance: number
  size?: 'xs' | 'sm' | 'md'
}

const formatEuro = (n: number) =>
  `€${Math.abs(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/**
 * Small colored dot to indicate a patient's outstanding balance at a glance.
 * Red = debit, green = credit, hidden if balance ~ 0.
 */
export default function BalanceDot({ balance, size = 'sm' }: Props) {
  if (Math.abs(balance) < 0.01) return null

  const isDebit = balance > 0
  const dimensions = {
    xs: 'w-1.5 h-1.5',
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
  }[size]

  const color = isDebit ? 'bg-destructive' : 'bg-success'
  const label = isDebit
    ? `Debito di ${formatEuro(balance)}`
    : `Credito di ${formatEuro(balance)}`

  return (
    <Tooltip label={label}>
      <span
        className={`inline-block rounded-full ${dimensions} ${color} flex-shrink-0`}
        aria-label={label}
      />
    </Tooltip>
  )
}
