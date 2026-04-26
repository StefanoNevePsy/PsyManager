import { SelectHTMLAttributes, forwardRef, useId } from 'react'
import { clsx } from 'clsx'
import { ChevronDown } from 'lucide-react'

interface Option {
  value: string
  label: string
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  hint?: string
  error?: string
  options: Option[]
  placeholder?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, hint, error, options, placeholder, className, id: providedId, required, ...props }, ref) => {
    const generatedId = useId()
    const id = providedId || generatedId
    const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-foreground">
            {label}
            {required && <span className="text-destructive ml-0.5">*</span>}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={id}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            required={required}
            className={clsx(
              'w-full h-10 bg-input border rounded-lg pl-3.5 pr-10 text-sm text-foreground appearance-none cursor-pointer',
              'transition-all duration-150 ease-out-quart',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background focus:border-ring',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              error
                ? 'border-destructive focus:ring-destructive focus:border-destructive'
                : 'border-border hover:border-foreground/15',
              className
            )}
            {...props}
          >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
        {error ? (
          <p id={`${id}-error`} className="text-xs text-destructive font-medium">
            {error}
          </p>
        ) : hint ? (
          <p id={`${id}-hint`} className="text-xs text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </div>
    )
  }
)

Select.displayName = 'Select'

export default Select
