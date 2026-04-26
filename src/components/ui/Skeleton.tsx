import { HTMLAttributes } from 'react'
import { clsx } from 'clsx'

export default function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx('rounded-md animate-shimmer', className)}
      aria-hidden="true"
      {...props}
    />
  )
}
