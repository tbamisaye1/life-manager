import { Minus, Plus } from 'lucide-react'
import { cn } from '../../lib/cn'
import {
  CUSTOM_DAYS_MAX,
  CUSTOM_DAYS_MIN,
  countForFilter,
  nextFilterKey,
  parseNextFilter,
} from '../../lib/taskFilters'
import { QUICK_DAY_OPTIONS, TASK_FILTER_GROUPS } from './taskFilterConfig'

function Chip({ active, onClick, icon: Icon, label, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors focus-ring',
        active
          ? 'bg-accent-600 text-white shadow-sm shadow-accent-600/20'
          : 'bg-zinc-100/80 text-zinc-600 hover:bg-zinc-200/80',
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />}
      {label}
      {count > 0 && (
        <span
          className={cn(
            'rounded-full px-1.5 text-[11px] tabular-nums',
            active ? 'bg-white/20' : 'bg-white text-zinc-500',
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}

function Stepper({ value, onChange, active }) {
  const clamp = (n) => Math.min(CUSTOM_DAYS_MAX, Math.max(CUSTOM_DAYS_MIN, n))
  return (
    <div
      className={cn(
        'inline-flex h-8 items-center overflow-hidden rounded-lg border',
        active ? 'border-accent-300 bg-white' : 'border-zinc-200 bg-white',
      )}
    >
      <button
        type="button"
        aria-label="Fewer days"
        disabled={value <= CUSTOM_DAYS_MIN}
        onClick={() => onChange(clamp(value - 1))}
        className="flex h-full w-8 items-center justify-center text-zinc-500 transition-colors hover:bg-zinc-50 disabled:opacity-30"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <input
        type="number"
        min={CUSTOM_DAYS_MIN}
        max={CUSTOM_DAYS_MAX}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (!Number.isFinite(n)) return
          onChange(clamp(n))
        }}
        className="h-full w-10 border-x border-zinc-200 bg-transparent text-center text-sm font-semibold tabular-nums text-zinc-800 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        aria-label="More days"
        disabled={value >= CUSTOM_DAYS_MAX}
        onClick={() => onChange(clamp(value + 1))}
        className="flex h-full w-8 items-center justify-center text-zinc-500 transition-colors hover:bg-zinc-50 disabled:opacity-30"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

const SCOPE_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'homework', label: 'Homework' },
]

/** Segmented filter tabs + custom N-day range for all / tasks / homework. */
export function TaskFilters({ value, onChange, counts = {}, tasks = [] }) {
  const custom = parseNextFilter(value)
  const days = custom?.days ?? 3
  const scope = custom?.scope ?? 'all'
  const customActive = custom != null
  const customKey = nextFilterKey(days, scope)
  const customCount = countForFilter(tasks, customKey)

  const setCustom = (nextDays, nextScope) => {
    onChange(nextFilterKey(nextDays, nextScope))
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
        {TASK_FILTER_GROUPS.map((group, i) => (
          <div key={group.id} className="flex flex-wrap items-center gap-1.5">
            {i > 0 && <span className="mx-0.5 hidden h-4 w-px bg-zinc-200 sm:inline-block" aria-hidden />}
            {group.filters.map((f) => (
              <Chip
                key={f.key}
                active={!customActive && value === f.key}
                onClick={() => onChange(f.key)}
                icon={f.icon}
                label={f.label}
                count={counts[f.key] || 0}
              />
            ))}
          </div>
        ))}
      </div>

      <div
        className={cn(
          'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3 py-2.5 transition-colors',
          customActive
            ? 'border-accent-200 bg-accent-50/60'
            : 'border-zinc-200/80 bg-zinc-50/60',
        )}
      >
        <button
          type="button"
          onClick={() => setCustom(days, scope)}
          className={cn(
            'text-xs font-semibold uppercase tracking-wide transition-colors focus-ring rounded',
            customActive ? 'text-accent-700' : 'text-zinc-500 hover:text-zinc-700',
          )}
        >
          Due in next
        </button>

        <Stepper value={days} active={customActive} onChange={(n) => setCustom(n, scope)} />

        <span className="text-sm text-zinc-500">{days === 1 ? 'day' : 'days'}</span>

        <div className="flex flex-wrap items-center gap-1">
          {QUICK_DAY_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setCustom(n, scope)}
              className={cn(
                'h-7 min-w-7 rounded-md px-2 text-xs font-medium tabular-nums transition-colors focus-ring',
                customActive && days === n
                  ? 'bg-accent-600 text-white'
                  : 'text-zinc-500 hover:bg-white hover:text-zinc-800',
              )}
            >
              {n}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="inline-flex rounded-lg bg-white p-0.5 shadow-sm ring-1 ring-zinc-200/80">
            {SCOPE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setCustom(days, opt.key)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-ring',
                  customActive && scope === opt.key
                    ? 'bg-accent-600 text-white'
                    : 'text-zinc-500 hover:text-zinc-800',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {customCount > 0 && (
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums',
                customActive ? 'bg-accent-100 text-accent-700' : 'bg-zinc-200/70 text-zinc-600',
              )}
            >
              {customCount}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
