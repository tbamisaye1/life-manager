import { ColorDot } from '../ui/ProjectTag'
import { formatTime } from '../../lib/format'

/** A single event row in the Today schedule. */
export function ScheduleItem({ event }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-50">
      <div className="w-16 shrink-0 text-xs font-medium text-zinc-500">
        {event.all_day ? 'All day' : formatTime(event.start)}
      </div>
      <ColorDot color={event.color} />
      <span className="flex-1 truncate text-sm text-zinc-800">{event.title}</span>
      {event.location && <span className="hidden text-xs text-zinc-400 sm:inline">{event.location}</span>}
    </div>
  )
}
