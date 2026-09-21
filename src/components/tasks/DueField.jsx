import { cn } from '../../lib/cn'
import { Input, Label } from '../ui'
import { END_OF_DAY_TIME, toDueInputValue } from '../../lib/format'

function pad(n) {
  return String(n).padStart(2, '0')
}

function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function addDaysKey(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return localDateKey(d)
}

function joinDue(dateKey, time) {
  if (!dateKey) return null
  return `${dateKey}T${time || END_OF_DAY_TIME}`
}

const PRESETS = [
  { key: 'today-eod', label: 'Today 11pm', build: () => joinDue(localDateKey(), END_OF_DAY_TIME) },
  { key: 'tomorrow-eod', label: 'Tomorrow 11pm', build: () => joinDue(addDaysKey(1), END_OF_DAY_TIME) },
  { key: 'today-925', label: 'Today 9:25', build: () => joinDue(localDateKey(), '09:25') },
  { key: 'tomorrow-925', label: 'Tomorrow 9:25', build: () => joinDue(addDaysKey(1), '09:25') },
]

/**
 * Due date + time control with quick chips for morning class vs end of day.
 */
export function DueField({ value, onChange, label = 'Due', className }) {
  const current = toDueInputValue(value)
  const timePart = current.includes('T') ? current.slice(11, 16) : ''

  return (
    <div className={cn('space-y-2', className)}>
      {label ? <Label>{label}</Label> : null}
      <Input
        type="datetime-local"
        value={current}
        onChange={(e) => onChange(e.target.value || null)}
      />
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => {
          const next = p.build()
          const active = current === next
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => onChange(next)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors focus-ring',
                active
                  ? 'border-accent-500 bg-accent-50 text-accent-700'
                  : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50',
              )}
            >
              {p.label}
            </button>
          )
        })}
        {value ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] font-medium text-zinc-500 hover:bg-zinc-50 focus-ring"
          >
            Clear
          </button>
        ) : null}
      </div>
      {timePart === END_OF_DAY_TIME ? (
        <p className="text-[11px] text-zinc-400">11:00 PM is the default when you only set a day.</p>
      ) : null}
    </div>
  )
}
