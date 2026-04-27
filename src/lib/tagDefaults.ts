// Available colors for patient tags
export const TAG_COLORS = [
  { id: 'blue', name: 'Blu', hex: '#3b82f6', css: 'blue' },
  { id: 'purple', name: 'Viola', hex: '#a855f7', css: 'purple' },
  { id: 'pink', name: 'Rosa', hex: '#ec4899', css: 'pink' },
  { id: 'red', name: 'Rosso', hex: '#ef4444', css: 'red' },
  { id: 'orange', name: 'Arancio', hex: '#f97316', css: 'orange' },
  { id: 'amber', name: 'Ambra', hex: '#f59e0b', css: 'amber' },
  { id: 'green', name: 'Verde', hex: '#22c55e', css: 'green' },
  { id: 'teal', name: 'Teal', hex: '#14b8a6', css: 'teal' },
  { id: 'cyan', name: 'Cyan', hex: '#06b6d4', css: 'cyan' },
  { id: 'slate', name: 'Grigio', hex: '#64748b', css: 'slate' },
] as const

// Available icons for patient tags (lucide icon names)
export const TAG_ICONS = [
  { id: 'tag', name: 'Tag' },
  { id: 'heart', name: 'Cuore' },
  { id: 'brain', name: 'Cervello' },
  { id: 'shield', name: 'Scudo' },
  { id: 'zap', name: 'Fulmine' },
  { id: 'star', name: 'Stella' },
  { id: 'user', name: 'Utente' },
  { id: 'users', name: 'Utenti' },
  { id: 'home', name: 'Casa' },
  { id: 'work', name: 'Lavoro' },
  { id: 'book', name: 'Libro' },
  { id: 'alert-circle', name: 'Attenzione' },
  { id: 'check-circle', name: 'Completato' },
  { id: 'clock', name: 'Orologio' },
  { id: 'trending-up', name: 'Progresso' },
  { id: 'phone', name: 'Telefono' },
] as const

export type TagColor = (typeof TAG_COLORS)[number]['id']
export type TagIcon = (typeof TAG_ICONS)[number]['id']

export const getColorValue = (colorId: string): string => {
  const color = TAG_COLORS.find((c) => c.id === colorId)
  return color?.hex || '#3b82f6'
}

export const getColorName = (colorId: string): string => {
  const color = TAG_COLORS.find((c) => c.id === colorId)
  return color?.name || 'Blu'
}

export const getIconName = (iconId: string): string => {
  const icon = TAG_ICONS.find((i) => i.id === iconId)
  return icon?.name || 'Tag'
}
