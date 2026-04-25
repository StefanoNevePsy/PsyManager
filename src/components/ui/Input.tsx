import { InputHTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className, id, ...props }, ref) => {
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
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={id}
            className={clsx(
              'w-full bg-input border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-colors',
              icon ? 'pl-10 pr-4 py-2' : 'px-4 py-2',
              error ? 'border-destructive' : '',
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input
