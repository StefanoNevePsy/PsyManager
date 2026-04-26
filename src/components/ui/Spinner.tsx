import { Loader2 } from 'lucide-react'
import { clsx } from 'clsx'

interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
  label?: string
}

const sizeClasses = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
}

export default function Spinner({ size = 'sm', className, label = 'Caricamento' }: SpinnerProps) {
  return (
    <Loader2
      className={clsx('animate-spin', sizeClasses[size], className)}
      aria-label={label}
      role="status"
    />
  )
}
