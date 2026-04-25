import { TextareaHTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-card-foreground"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={id}
          className={clsx(
            'w-full bg-input border border-border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary transition-colors min-h-[80px]',
            error ? 'border-destructive' : '',
            className
          )}
          {...props}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'

export default Textarea
