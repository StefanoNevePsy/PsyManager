import { cloneElement, isValidElement, useId, useRef, useState } from 'react'
import { clsx } from 'clsx'

interface TooltipProps {
  label: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  children: React.ReactElement
  disabled?: boolean
  delay?: number
}

const sideClasses = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
}

export default function Tooltip({
  label,
  side = 'top',
  children,
  disabled = false,
  delay = 250,
}: TooltipProps) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const timer = useRef<number | null>(null)

  if (!isValidElement(children) || disabled) {
    return children
  }

  const show = () => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOpen(true), delay)
  }

  const hide = () => {
    if (timer.current) window.clearTimeout(timer.current)
    setOpen(false)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const child = children as React.ReactElement<any>
  const augmented = cloneElement(child, {
    'aria-describedby': open ? id : child.props['aria-describedby'],
    onMouseEnter: (e: React.MouseEvent) => {
      child.props.onMouseEnter?.(e)
      show()
    },
    onMouseLeave: (e: React.MouseEvent) => {
      child.props.onMouseLeave?.(e)
      hide()
    },
    onFocus: (e: React.FocusEvent) => {
      child.props.onFocus?.(e)
      show()
    },
    onBlur: (e: React.FocusEvent) => {
      child.props.onBlur?.(e)
      hide()
    },
  })

  return (
    <span className="relative inline-flex">
      {augmented}
      {open && (
        <span
          role="tooltip"
          id={id}
          className={clsx(
            'absolute z-50 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-2xs font-medium text-background shadow-pop pointer-events-none animate-fade-in',
            sideClasses[side]
          )}
        >
          {label}
        </span>
      )}
    </span>
  )
}
