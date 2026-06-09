import { cn } from '../../lib/cn'

/** Generic segmented tab control following TaskFilters style. */
export function GymTabs({ tabs, value, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-zinc-200 pb-2 mb-6">
      {tabs.map((tab) => {
        const active = value === tab.key
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-accent-500/30',
              active ? 'bg-accent-600 text-white' : 'text-zinc-500 hover:bg-zinc-100',
            )}
          >
            {tab.icon && <tab.icon className="h-4 w-4" />}
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
