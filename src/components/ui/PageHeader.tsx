interface Props {
  title: string
  description?: string
  action?: React.ReactNode
  eyebrow?: string
}

export default function PageHeader({ title, description, action, eyebrow }: Props) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap pb-2">
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <p className="text-xs font-medium tracking-wider uppercase text-muted-foreground mb-2">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-3xl md:text-4xl font-semibold text-foreground tracking-tight leading-[1.1]">
          {title}
        </h1>
        {description && (
          <p className="text-muted-foreground text-sm md:text-base mt-2 leading-relaxed max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}
