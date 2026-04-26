import { InputHTMLAttributes, forwardRef, useId } from 'react'
import { clsx } from 'clsx'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  icon?: React.ReactNode
  rightSlot?: React.ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, icon, rightSlot, className, id: providedId, required, ...props }, ref) => {
    const generatedId = useId()
    const id = providedId || generatedId
    const describedBy = error
      ? `${id}-error`
      : hint
        ? `${id}-hint`
        : undefined

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-foreground"
          >
            {label}
            {required && <span className="text-destructive ml-0.5">*</span>}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={id}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            required={required}
            className={clsx(
              'w-full h-10 bg-input border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/70',
              'transition-all duration-150 ease-out-quart',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background focus:border-ring',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              icon ? 'pl-10' : 'pl-3.5',
              rightSlot ? 'pr-10' : 'pr-3.5',
              error
                ? 'border-destructive focus:ring-destructive focus:border-destructive'
                : 'border-border hover:border-foreground/15',
              className
            )}
            {...props}
          />
          {rightSlot && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {rightSlot}
            </div>
          )}
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

Input.displayName = 'Input'

export default Input
