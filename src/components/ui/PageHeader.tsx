interface Props {
  title: string
  description?: string
  action?: React.ReactNode
}

export default function PageHeader({ title, description, action }: Props) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">
          {title}
        </h1>
        {description && (
          <p className="text-muted-foreground text-sm md:text-base">{description}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}
