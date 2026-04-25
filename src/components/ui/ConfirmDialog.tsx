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
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      {description && (
        <p className="text-muted-foreground mb-6">{description}</p>
      )}
      <div className="flex justify-end gap-2">
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
