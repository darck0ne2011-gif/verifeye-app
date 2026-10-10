export default function PageHeader({ title, subtitle, action = null }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-fg">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
