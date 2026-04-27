import { getColorValue } from '@/lib/tagDefaults'
import { X } from 'lucide-react'
import * as Icons from 'lucide-react'

interface TagBadgeProps {
  name: string
  color: string
  icon: string
  onRemove?: () => void
  size?: 'sm' | 'md'
}

// Accepts both PascalCase ("AlertCircle") and legacy kebab/lowercase ("alert-circle", "tag")
const resolveIcon = (id: string): React.ComponentType<{ className?: string; strokeWidth?: number }> => {
  const direct = (Icons as any)[id]
  if (direct) return direct
  // Convert "alert-circle" or "alertcircle" -> "AlertCircle"
  const pascal = id
    .split(/[-_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('')
  return (Icons as any)[pascal] || Icons.Tag
}

export default function TagBadge({
  name,
  color,
  icon,
  onRemove,
  size = 'md',
}: TagBadgeProps) {
  const hexColor = getColorValue(color)
  const IconComponent = resolveIcon(icon)
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'
  const padding = size === 'sm' ? 'px-2 py-0.5 text-2xs' : 'px-2.5 py-1 text-xs'

  return (
    <div
      className={`${padding} rounded-full font-medium flex items-center gap-1.5 whitespace-nowrap transition-all`}
      style={{
        backgroundColor: `${hexColor}15`,
        color: hexColor,
        border: `1px solid ${hexColor}40`,
      }}
    >
      <IconComponent className={iconSize} strokeWidth={2} />
      <span>{name}</span>
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-0.5 hover:opacity-70 transition-opacity"
          aria-label={`Rimuovi tag ${name}`}
        >
          <X className="w-3 h-3" strokeWidth={2.5} />
        </button>
      )}
    </div>
  )
}
