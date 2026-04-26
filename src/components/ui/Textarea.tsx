import { TextareaHTMLAttributes, forwardRef, useId } from 'react'
import { clsx } from 'clsx'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  error?: string
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, className, id: providedId, required, ...props }, ref) => {
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
        <textarea
          ref={ref}
          id={id}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          required={required}
          className={clsx(
            'w-full bg-input border rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70',
            'transition-all duration-150 ease-out-quart resize-y min-h-[88px]',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background focus:border-ring',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error
              ? 'border-destructive focus:ring-destructive focus:border-destructive'
              : 'border-border hover:border-foreground/15',
            className
          )}
          {...props}
        />
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

Textarea.displayName = 'Textarea'

export default Textarea
