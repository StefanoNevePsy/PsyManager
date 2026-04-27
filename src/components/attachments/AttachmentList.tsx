import { useState } from 'react'
import {
  FileText,
  FileImage,
  Paperclip,
  Trash2,
  Upload,
  Eye,
  Loader2,
} from 'lucide-react'
import {
  useAttachments,
  useUploadAttachment,
  useDeleteAttachment,
  getAttachmentUrl,
} from '@/hooks/useAttachments'
import { Button, ConfirmDialog, useToast, Tooltip } from '@/components/ui'
import { Database } from '@/types/database'

type Attachment = Database['public']['Tables']['attachments']['Row']
type OwnerType = 'patient' | 'clinical_note'

const MAX_FILE_SIZE_MB = 10

const isImage = (mime: string) => mime.startsWith('image/') && mime !== 'application/pdf'
const isPdf = (mime: string) => mime === 'application/pdf'

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface Props {
  ownerType: OwnerType
  ownerId: string | undefined
  title?: string
  description?: string
  compact?: boolean
}

export default function AttachmentList({
  ownerType,
  ownerId,
  title = 'Allegati',
  description = 'Immagini, SVG di genogrammi, PDF (max 10 MB ciascuno)',
  compact = false,
}: Props) {
  const { toast } = useToast()
  const { data: attachments = [], isLoading } = useAttachments(ownerType, ownerId)
  const uploadMutation = useUploadAttachment()
  const deleteMutation = useDeleteAttachment()
  const [deleting, setDeleting] = useState<Attachment | null>(null)
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !ownerId) return

    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        toast.error(`${file.name} è troppo grande`, {
          description: `Il limite è ${MAX_FILE_SIZE_MB} MB per file`,
        })
        continue
      }

      try {
        await uploadMutation.mutateAsync({ file, ownerType, ownerId })
        toast.success(`${file.name} caricato`)
      } catch (err) {
        toast.error('Caricamento fallito', {
          description: err instanceof Error ? err.message : 'Riprova',
        })
      }
    }

    // Reset the input so the same file can be re-uploaded
    e.target.value = ''
  }

  const handleOpen = async (att: Attachment) => {
    try {
      const url = await getAttachmentUrl(att.storage_path)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (err) {
      toast.error('Impossibile aprire il file', {
        description: err instanceof Error ? err.message : 'Riprova',
      })
    }
  }

  const handlePreviewLoad = async (att: Attachment) => {
    if (previewUrls[att.id]) return
    try {
      const url = await getAttachmentUrl(att.storage_path)
      setPreviewUrls((prev) => ({ ...prev, [att.id]: url }))
    } catch {
      // Silently skip preview if URL generation fails
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await deleteMutation.mutateAsync(deleting)
      toast.success('Allegato eliminato')
      setDeleting(null)
    } catch (err) {
      toast.error('Eliminazione fallita', {
        description: err instanceof Error ? err.message : 'Riprova',
      })
    }
  }

  // Trigger preview URL generation for new images
  attachments.forEach((att) => {
    if (isImage(att.mime_type) && !previewUrls[att.id]) {
      handlePreviewLoad(att)
    }
  })

  if (!ownerId) {
    return (
      <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground italic">
        Salva prima per allegare file
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5" strokeWidth={2} />
              {title}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
      )}

      <label className="cursor-pointer inline-flex">
        <input
          type="file"
          multiple
          accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,application/pdf"
          onChange={handleFileChange}
          disabled={uploadMutation.isPending}
          className="sr-only"
        />
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
            uploadMutation.isPending
              ? 'opacity-60 pointer-events-none border-border bg-secondary/50'
              : 'border-border bg-card hover:bg-secondary/50'
          }`}
        >
          {uploadMutation.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
          ) : (
            <Upload className="w-3.5 h-3.5" strokeWidth={2} />
          )}
          {uploadMutation.isPending ? 'Caricamento...' : 'Carica file'}
        </span>
      </label>

      {isLoading ? (
        <div className="text-xs text-muted-foreground">Caricamento allegati...</div>
      ) : attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Nessun allegato</p>
      ) : (
        <ul className="space-y-2">
          {attachments.map((att) => {
            const previewUrl = previewUrls[att.id]
            return (
              <li
                key={att.id}
                className="flex items-start gap-3 p-2.5 rounded-md border border-border bg-card hover:bg-secondary/30 transition-colors"
              >
                {isImage(att.mime_type) && previewUrl ? (
                  <button
                    type="button"
                    onClick={() => handleOpen(att)}
                    className="flex-shrink-0 w-12 h-12 rounded overflow-hidden bg-muted"
                  >
                    <img
                      src={previewUrl}
                      alt={att.file_name}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ) : (
                  <div
                    className={`flex-shrink-0 w-12 h-12 rounded flex items-center justify-center ${
                      isPdf(att.mime_type)
                        ? 'bg-destructive-soft text-destructive'
                        : 'bg-secondary text-muted-foreground'
                    }`}
                  >
                    {isImage(att.mime_type) ? (
                      <FileImage className="w-5 h-5" strokeWidth={1.85} />
                    ) : (
                      <FileText className="w-5 h-5" strokeWidth={1.85} />
                    )}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {att.file_name}
                  </p>
                  <p className="text-2xs text-muted-foreground tabular-nums">
                    {formatBytes(att.size_bytes)} · {att.mime_type.split('/')[1]?.toUpperCase()}
                  </p>
                </div>
                <div className="flex gap-0.5 flex-shrink-0">
                  <Tooltip label="Apri">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpen(att)}
                    >
                      <Eye className="w-4 h-4" strokeWidth={1.85} />
                    </Button>
                  </Tooltip>
                  <Tooltip label="Elimina">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleting(att)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" strokeWidth={1.85} />
                    </Button>
                  </Tooltip>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmDialog
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Eliminare l'allegato?"
        description={
          deleting
            ? `Il file "${deleting.file_name}" verrà eliminato definitivamente.`
            : ''
        }
        confirmText="Elimina"
        destructive
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
