import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Palette } from 'lucide-react'
import { serviceTypeSchema, ServiceTypeFormData } from '@/lib/schemas'
import { Button, Input, Select } from '@/components/ui'
import { Database } from '@/types/database'
import { SERVICE_PALETTE } from '@/lib/serviceColors'
import { PAYMENT_METHOD_LABELS } from '@/lib/netIncome'

type ServiceType = Database['public']['Tables']['service_types']['Row']

interface Props {
  initialData?: ServiceType
  onSubmit: (data: ServiceTypeFormData) => void | Promise<void>
  onCancel: () => void
  loading?: boolean
}

export default function ServiceTypeForm({
  initialData,
  onSubmit,
  onCancel,
  loading = false,
}: Props) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ServiceTypeFormData>({
    resolver: zodResolver(serviceTypeSchema),
    defaultValues: {
      name: initialData?.name || '',
      duration_minutes: initialData?.duration_minutes || 60,
      price: initialData?.price || 0,
      type: initialData?.type || 'private',
      color: initialData?.color || '',
      center_percentage: initialData?.center_percentage ?? 0,
      default_payment_method: initialData?.default_payment_method || '',
    },
  })

  const selectedColor = watch('color') || ''
  const isCustomColor = !!selectedColor && !SERVICE_PALETTE.includes(selectedColor)

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        id="name"
        label="Nome Prestazione *"
        placeholder="es. Seduta Individuale, Terapia di Coppia, Gruppo Familiare"
        {...register('name')}
        error={errors.name?.message}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          id="duration_minutes"
          label="Durata (minuti) *"
          type="number"
          min={1}
          {...register('duration_minutes', { valueAsNumber: true })}
          error={errors.duration_minutes?.message}
        />

        <Input
          id="price"
          label="Prezzo (€) *"
          type="number"
          step="0.01"
          min={0}
          {...register('price', { valueAsNumber: true })}
          error={errors.price?.message}
        />
      </div>

      <Select
        id="type"
        label="Tipologia *"
        {...register('type')}
        error={errors.type?.message}
        options={[
          { value: 'private', label: 'Privato (paziente paga direttamente)' },
          { value: 'package', label: 'Pacchetto (struttura paga forfait)' },
        ]}
      />

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-foreground">Colore</label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setValue('color', '', { shouldDirty: true })}
            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-2xs font-semibold uppercase text-muted-foreground bg-muted transition-all ${
              selectedColor === '' ? 'border-primary ring-2 ring-primary/30' : 'border-border'
            }`}
            aria-label="Colore automatico"
            title="Automatico"
          >
            A
          </button>

          {SERVICE_PALETTE.map((hex) => (
            <button
              key={hex}
              type="button"
              onClick={() => setValue('color', hex, { shouldDirty: true })}
              className={`w-8 h-8 rounded-full border-2 transition-all ${
                selectedColor === hex ? 'border-primary ring-2 ring-primary/30' : 'border-transparent'
              }`}
              style={{ backgroundColor: hex }}
              aria-label={`Colore ${hex}`}
              title={hex}
            />
          ))}

          <label
            className={`relative w-8 h-8 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all ${
              isCustomColor ? 'border-primary ring-2 ring-primary/30' : 'border-border'
            }`}
            style={isCustomColor ? { backgroundColor: selectedColor } : undefined}
            title="Colore personalizzato"
          >
            {!isCustomColor && <Palette className="w-4 h-4 text-muted-foreground" strokeWidth={1.85} />}
            <input
              type="color"
              value={isCustomColor ? selectedColor : '#3b82f6'}
              onChange={(e) => setValue('color', e.target.value, { shouldDirty: true })}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              aria-label="Colore personalizzato"
            />
          </label>
        </div>
        {errors.color?.message && (
          <p className="text-xs text-destructive font-medium">{errors.color.message}</p>
        )}
      </div>

      <Input
        id="center_percentage"
        label="Percentuale del centro (%)"
        type="number"
        min={0}
        max={100}
        step="0.01"
        hint="Quota della seduta che spetta al centro (per prestazioni fatturate tramite centro)"
        {...register('center_percentage', { valueAsNumber: true })}
        error={errors.center_percentage?.message}
      />

      <Select
        id="default_payment_method"
        label="Metodo di pagamento predefinito"
        hint="Usato per stimare il netto delle sedute non ancora pagate"
        {...register('default_payment_method')}
        error={errors.default_payment_method?.message}
        options={[
          { value: '', label: 'Nessuno (fattura diretta)' },
          ...Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => ({ value, label })),
        ]}
      />

      <div className="flex justify-end gap-2 pt-4 border-t border-border">
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
