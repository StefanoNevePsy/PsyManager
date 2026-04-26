import { HTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
  variant?: 'default' | 'quiet' | 'inset'
}

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
}

const variantClasses = {
  default: 'bg-card border border-border shadow-soft',
  quiet: 'bg-card/60 border border-border/60',
  inset: 'bg-muted/40 border border-border/40',
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    { hover = false, padding = 'lg', variant = 'default', className, children, ...props },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={clsx(
          'rounded-lg transition-all duration-200 ease-out-quart',
          variantClasses[variant],
          paddingClasses[padding],
          hover && 'hover:border-foreground/15 hover:shadow-pop cursor-pointer',
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'

export default Card
