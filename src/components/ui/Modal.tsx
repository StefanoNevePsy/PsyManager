import { useEffect } from 'react'
import { X } from 'lucide-react'
import { clsx } from 'clsx'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-xl',
  xl: 'max-w-3xl',
}

export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-foreground/40 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        className={clsx(
          'w-full bg-card border border-border rounded-t-2xl sm:rounded-xl shadow-modal max-h-[92vh] overflow-hidden flex flex-col animate-slide-up',
          sizeClasses[size]
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || description) && (
          <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 flex-shrink-0">
            <div className="min-w-0 flex-1">
              {title && (
                <h2
                  id="modal-title"
                  className="font-display text-2xl font-semibold text-card-foreground leading-tight tracking-tight"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                  {description}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 -mt-1 -mr-1 p-2 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Chiudi finestra"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="px-6 pb-6 overflow-auto flex-1">{children}</div>
      </div>
    </div>
  )
}
