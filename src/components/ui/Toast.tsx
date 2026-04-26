import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { clsx } from 'clsx'

type ToastVariant = 'success' | 'error' | 'warning' | 'info'

interface ToastItem {
  id: string
  variant: ToastVariant
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  duration?: number
}

interface ToastContextValue {
  toast: {
    success: (title: string, opts?: Omit<ToastItem, 'id' | 'variant' | 'title'>) => void
    error: (title: string, opts?: Omit<ToastItem, 'id' | 'variant' | 'title'>) => void
    warning: (title: string, opts?: Omit<ToastItem, 'id' | 'variant' | 'title'>) => void
    info: (title: string, opts?: Omit<ToastItem, 'id' | 'variant' | 'title'>) => void
  }
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (variant: ToastVariant, title: string, opts?: Omit<ToastItem, 'id' | 'variant' | 'title'>) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      setToasts((prev) => [...prev, { id, variant, title, ...opts }])
    },
    []
  )

  const toast = {
    success: (title: string, opts?: Omit<ToastItem, 'id' | 'variant' | 'title'>) =>
      push('success', title, opts),
    error: (title: string, opts?: Omit<ToastItem, 'id' | 'variant' | 'title'>) =>
      push('error', title, opts),
    warning: (title: string, opts?: Omit<ToastItem, 'id' | 'variant' | 'title'>) =>
      push('warning', title, opts),
    info: (title: string, opts?: Omit<ToastItem, 'id' | 'variant' | 'title'>) =>
      push('info', title, opts),
  }

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] sm:w-auto pointer-events-none"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

const variantStyles: Record<ToastVariant, { icon: typeof CheckCircle2; bg: string; border: string; iconColor: string }> = {
  success: {
    icon: CheckCircle2,
    bg: 'bg-success-soft',
    border: 'border-success/30',
    iconColor: 'text-success',
  },
  error: {
    icon: XCircle,
    bg: 'bg-destructive-soft',
    border: 'border-destructive/30',
    iconColor: 'text-destructive',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-warning-soft',
    border: 'border-warning/30',
    iconColor: 'text-warning',
  },
  info: {
    icon: Info,
    bg: 'bg-primary-soft',
    border: 'border-primary/30',
    iconColor: 'text-primary',
  },
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const styles = variantStyles[item.variant]
  const Icon = styles.icon
  const duration = item.duration ?? 4500

  useEffect(() => {
    if (duration === Infinity) return
    const t = setTimeout(onDismiss, duration)
    return () => clearTimeout(t)
  }, [duration, onDismiss])

  return (
    <div
      role="status"
      className={clsx(
        'pointer-events-auto flex items-start gap-3 rounded-lg border p-3.5 pr-2 shadow-pop bg-card',
        'animate-slide-in-from-bottom backdrop-blur-sm',
        styles.border
      )}
    >
      <div className={clsx('flex-shrink-0 mt-0.5', styles.iconColor)}>
        <Icon className="w-5 h-5" strokeWidth={2.25} />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-sm font-semibold text-foreground leading-tight">{item.title}</p>
        {item.description && (
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{item.description}</p>
        )}
        {item.action && (
          <button
            type="button"
            onClick={() => {
              item.action?.onClick()
              onDismiss()
            }}
            className="mt-2 text-sm font-medium text-primary hover:underline underline-offset-2"
          >
            {item.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Chiudi notifica"
        className="flex-shrink-0 p-1 rounded-md hover:bg-foreground/5 text-muted-foreground"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
