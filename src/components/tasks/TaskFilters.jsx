import { cn } from '../../lib/cn'
import { TASK_FILTERS } from './taskFilterConfig'

/** Segmented filter tabs for the tasks list. */
export function TaskFilters({ value, onChange, counts = {} }) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-zinc-200 pb-2">
      {TASK_FILTERS.map((f) => {
        const active = value === f.key
        return (
          <button
            key={f.key}
            type="button"
            onClick={() => onChange(f.key)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-ring',
              active ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-100',
            )}
          >
            <f.icon className="h-4 w-4" />
            {f.label}
            {counts[f.key] > 0 && (
              <span className={cn('rounded-full px-1.5 text-xs', active ? 'bg-white/20' : 'bg-zinc-200 text-zinc-600')}>
                {counts[f.key]}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
