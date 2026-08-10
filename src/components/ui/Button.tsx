import { ButtonHTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'
import Spinner from './Spinner'

type Variant = 'primary' | 'secondary' | 'destructive' | 'ghost' | 'outline' | 'subtle'
type Size = 'sm' | 'md' | 'lg' | 'icon'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/95 shadow-soft',
  secondary:
    'bg-secondary text-secondary-foreground hover:bg-secondary/70 active:bg-secondary',
  destructive:
    'bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/95 shadow-soft',
  ghost:
    'text-foreground hover:bg-secondary/70 active:bg-secondary',
  outline:
    'border border-border bg-transparent text-foreground hover:bg-secondary/60 hover:border-foreground/20 active:bg-secondary',
  subtle:
    'bg-primary-soft text-primary hover:bg-primary-soft/70 active:bg-primary-soft',
}

// Base sizes are tuned for mouse/desktop density. `pointer-coarse` (touch
// screens) bumps every variant up to a 44px minimum — Apple/Material's
// baseline comfortable tap target — without changing the compact desktop
// look. `icon` grows both dimensions together so it stays square.
const sizeClasses: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5 rounded-md pointer-coarse:min-h-[44px] pointer-coarse:px-3.5',
  md: 'h-10 px-4 text-sm gap-2 rounded-lg pointer-coarse:min-h-[44px]',
  lg: 'h-12 px-6 text-base gap-2 rounded-lg pointer-coarse:min-h-[48px]',
  icon: 'h-9 w-9 p-0 rounded-md pointer-coarse:min-h-[44px] pointer-coarse:min-w-[44px]',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      className,
      children,
      type = 'button',
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={clsx(
          'inline-flex items-center justify-center font-medium transition-all duration-150 ease-out-quart',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          // Never let a flex/grid parent squash the button below its own
          // size, and never let long Italian labels ("Registra pagamento")
          // wrap into an ugly ragged second line — callers that need
          // wrapping should size their container instead (e.g. w-full).
          'select-none flex-shrink-0 whitespace-nowrap',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {loading && <Spinner size={size === 'lg' ? 'md' : 'sm'} />}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export default Button
