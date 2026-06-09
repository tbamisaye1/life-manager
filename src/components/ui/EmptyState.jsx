import { cn } from '../../lib/cn'

/** Friendly empty placeholder for data-driven views. */
export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 px-6 py-12 text-center', className)}>
      {Icon && (
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <p className="text-sm font-medium text-zinc-700">{title}</p>
      {description && <p className="mt-1 max-w-xs text-sm text-zinc-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
