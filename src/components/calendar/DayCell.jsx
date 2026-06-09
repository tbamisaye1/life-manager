import { isToday } from 'date-fns'
import { Plus } from 'lucide-react'
import { cn } from '../../lib/cn'
import { EventChip } from './EventChip'

const MAX_CHIPS = 3

/**
 * A single day cell in the month grid.
 * Props: date (Date), events ([]), isCurrentMonth (bool),
 *        onAddEvent(date), onOpenEvent(event)
 */
export function DayCell({ date, events, isCurrentMonth, onAddEvent, onOpenEvent }) {
  const today = isToday(date)
  const overflow = events.length - MAX_CHIPS
  const visible = events.slice(0, MAX_CHIPS)

  return (
    <div
      className={cn(
        'group relative min-h-[108px] border-b border-r border-zinc-100 p-1.5 pb-2',
        !isCurrentMonth && 'bg-zinc-50/60',
      )}
      onClick={() => onAddEvent(date)}
    >
      {/* Date number */}
      <div className="mb-1 flex items-center justify-between">
        <span
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
            today
              ? 'bg-accent-600 text-white'
              : isCurrentMonth
              ? 'text-zinc-700'
              : 'text-zinc-300',
          )}
        >
          {date.getDate()}
        </span>

        {/* Hover "+" affordance */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onAddEvent(date) }}
          aria-label={`Add event on ${date.toDateString()}`}
          className="hidden h-5 w-5 items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 group-hover:flex"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Event chips */}
      <div className="space-y-0.5">
        {visible.map((ev) => (
          <EventChip key={ev.id} event={ev} onClick={onOpenEvent} />
        ))}
        {overflow > 0 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpenEvent(events[MAX_CHIPS]) }}
            className="w-full text-left px-1.5 text-xs text-zinc-400 hover:text-zinc-600"
          >
            +{overflow} more
          </button>
        )}
      </div>
    </div>
  )
}
