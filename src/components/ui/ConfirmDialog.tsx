import { AlertTriangle } from 'lucide-react'
import Modal from './Modal'
import Button from './Button'

interface Props {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  destructive?: boolean
  loading?: boolean
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Conferma',
  cancelText = 'Annulla',
  destructive = false,
  loading = false,
}: Props) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <div className="flex gap-4">
        {destructive && (
          <div className="flex-shrink-0 w-11 h-11 rounded-full bg-destructive-soft text-destructive flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" strokeWidth={2} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-semibold text-foreground tracking-tight leading-tight">
            {title}
          </h2>
          {description && (
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <Button variant="outline" onClick={onClose} disabled={loading}>
          {cancelText}
        </Button>
        <Button
          variant={destructive ? 'destructive' : 'primary'}
          onClick={onConfirm}
          loading={loading}
        >
          {confirmText}
        </Button>
      </div>
    </Modal>
  )
}
