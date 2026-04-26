import { LucideIcon } from 'lucide-react'
import { clsx } from 'clsx'

interface Props {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  tone?: 'neutral' | 'primary' | 'success' | 'warning'
}

const sizeStyles = {
  sm: { padding: 'py-8', iconBox: 'w-12 h-12', iconSize: 'w-5 h-5' },
  md: { padding: 'py-12', iconBox: 'w-14 h-14', iconSize: 'w-6 h-6' },
  lg: { padding: 'py-16', iconBox: 'w-16 h-16', iconSize: 'w-7 h-7' },
}

const toneStyles = {
  neutral: 'bg-muted text-muted-foreground border-border',
  primary: 'bg-primary-soft text-primary border-primary/20',
  success: 'bg-success-soft text-success border-success/20',
  warning: 'bg-warning-soft text-warning border-warning/20',
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = 'md',
  tone = 'neutral',
}: Props) {
  const s = sizeStyles[size]
  return (
    <div className={clsx('flex flex-col items-center justify-center text-center', s.padding)}>
      {Icon && (
        <div
          className={clsx(
            'rounded-2xl border flex items-center justify-center mb-4',
            s.iconBox,
            toneStyles[tone]
          )}
        >
          <Icon className={s.iconSize} strokeWidth={1.75} />
        </div>
      )}
      <h3 className="font-display text-xl font-semibold text-foreground mb-1.5 tracking-tight">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm leading-relaxed mb-6">
          {description}
        </p>
      )}
      {action}
    </div>
  )
}
