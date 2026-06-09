import { colorClasses } from '../../lib/colors'
import { formatTime } from '../../lib/format'
import { cn } from '../../lib/cn'

/**
 * A single positioned event block in the day timeline.
 * Absolutely positioned by the parent DayTimeline.
 * Props: event, style (top/height/left/width), onClick
 */
export function ScheduleBlock({ event, style, onClick }) {
  const { soft } = colorClasses(event.color)

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(event) }}
      style={style}
      className={cn(
        'absolute overflow-hidden rounded-lg px-2 py-1 text-left transition-opacity hover:opacity-80',
        'flex flex-col justify-start border border-black/10',
        soft,
      )}
      title={event.title}
    >
      <span className="truncate text-xs font-semibold leading-tight">
        {event.title}
      </span>
      <span className="truncate text-[11px] opacity-90 leading-tight mt-0.5">
        {formatTime(event.start)}
        {event.end && ` – ${formatTime(event.end)}`}
      </span>
    </button>
  )
}
