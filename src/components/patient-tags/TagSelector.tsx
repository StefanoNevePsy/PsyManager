import { Check } from 'lucide-react'
import { usePatientTags } from '@/hooks/usePatientTags'
import TagBadge from './TagBadge'
import { Button, Skeleton } from '@/components/ui'

interface TagSelectorProps {
  selectedTagIds: string[]
  onTagToggle: (tagId: string) => void
  onCreateClick?: () => void
}

export default function TagSelector({
  selectedTagIds,
  onTagToggle,
  onCreateClick,
}: TagSelectorProps) {
  const { tags, isLoading } = usePatientTags()

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {tags.length === 0 ? (
        <div className="p-3 rounded-lg border border-dashed border-border bg-secondary/30 text-center">
          <p className="text-sm text-muted-foreground mb-2">Nessun tag disponibile</p>
          {onCreateClick && (
            <Button size="sm" variant="outline" onClick={onCreateClick}>
              Crea il primo tag
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {tags.map((tag) => {
            const isSelected = selectedTagIds.includes(tag.id)
            return (
              <button
                key={tag.id}
                onClick={() => onTagToggle(tag.id)}
                className="w-full flex items-center gap-2 p-2.5 rounded-lg border transition-all hover:bg-secondary/50"
                style={{
                  borderColor: isSelected ? 'currentColor' : 'var(--border)',
                  color: isSelected ? 'var(--primary)' : 'var(--foreground)',
                }}
              >
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                    isSelected ? 'opacity-100' : 'opacity-50'
                  }`}
                  style={{
                    borderColor: 'currentColor',
                    backgroundColor: isSelected ? 'currentColor' : 'transparent',
                  }}
                >
                  {isSelected && <Check className="w-3 h-3 text-background" strokeWidth={3} />}
                </div>
                <TagBadge name={tag.name} color={tag.color} icon={tag.icon} size="sm" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
