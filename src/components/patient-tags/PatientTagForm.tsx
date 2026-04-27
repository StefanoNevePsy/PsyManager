import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { patientTagSchema, PatientTagFormData } from '@/lib/schemas'
import { TAG_COLORS, TAG_ICONS, getColorValue } from '@/lib/tagDefaults'
import { Button } from '@/components/ui'
import * as Icons from 'lucide-react'
import { Database } from '@/types/database'

type PatientTag = Database['public']['Tables']['patient_tags']['Row']

interface Props {
  initialData?: PatientTag
  onSubmit: (data: PatientTagFormData) => void | Promise<void>
  onCancel: () => void
  loading?: boolean
}

export default function PatientTagForm({
  initialData,
  onSubmit,
  onCancel,
  loading = false,
}: Props) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<PatientTagFormData>({
    resolver: zodResolver(patientTagSchema),
    defaultValues: {
      name: initialData?.name || '',
      color: initialData?.color || 'blue',
      icon: initialData?.icon || 'Tag',
    },
  })

  const selectedColor = watch('color')
  const selectedIcon = watch('icon')
  const selectedColorValue = getColorValue(selectedColor)

  const resolveIcon = (id: string) => {
    const direct = (Icons as any)[id]
    if (direct) return direct
    const pascal = id
      .split(/[-_\s]+/)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
      .join('')
    return (Icons as any)[pascal] || Icons.Tag
  }
  const IconComponent = resolveIcon(selectedIcon)

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1.5">
          Nome del tag
        </label>
        <input
          id="name"
          type="text"
          placeholder="Es. Ansia, Trauma, Depressione"
          {...register('name')}
          className={`w-full px-3 py-2 rounded-md border ${
            errors.name ? 'border-red-500' : 'border-border'
          } bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all`}
        />
        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Color picker */}
        <div>
          <label htmlFor="color" className="block text-sm font-medium mb-2">
            Colore
          </label>
          <div className="grid grid-cols-5 gap-2">
            {TAG_COLORS.map((c) => (
              <label key={c.id} className="cursor-pointer">
                <input
                  type="radio"
                  value={c.id}
                  {...register('color')}
                  className="sr-only"
                />
                <div
                  className={`w-full aspect-square rounded-lg border-2 transition-all ${
                    selectedColor === c.id
                      ? 'border-foreground scale-110'
                      : 'border-border hover:border-foreground/50'
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                />
              </label>
            ))}
          </div>
        </div>

        {/* Icon picker */}
        <div>
          <label htmlFor="icon" className="block text-sm font-medium mb-2">
            Icona
          </label>
          <div className="grid grid-cols-4 gap-2">
            {TAG_ICONS.map((ic) => {
              const Ico = (Icons as any)[ic.id] || Icons.Tag
              return (
                <label key={ic.id} className="cursor-pointer">
                  <input
                    type="radio"
                    value={ic.id}
                    {...register('icon')}
                    className="sr-only"
                  />
                  <div
                    className={`w-full aspect-square rounded-lg border-2 flex items-center justify-center transition-all ${
                      selectedIcon === ic.id
                        ? 'border-foreground scale-110'
                        : 'border-border hover:border-foreground/50'
                    }`}
                    title={ic.name}
                  >
                    <Ico className="w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                </label>
              )
            })}
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="p-3 rounded-lg bg-secondary/50 border border-border">
        <p className="text-xs text-muted-foreground mb-2">Anteprima:</p>
        <div
          className="w-fit px-3 py-1.5 rounded-full flex items-center gap-2 font-medium text-sm"
          style={{
            backgroundColor: `${selectedColorValue}15`,
            color: selectedColorValue,
            border: `1px solid ${selectedColorValue}40`,
          }}
        >
          <IconComponent className="w-4 h-4" strokeWidth={2} />
          <span>{watch('name') || 'Nome tag'}</span>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Annulla
        </Button>
        <Button type="submit" loading={loading}>
          {initialData ? 'Aggiorna' : 'Crea'}
        </Button>
      </div>
    </form>
  )
}
