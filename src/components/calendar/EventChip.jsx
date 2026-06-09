import { colorClasses } from '../../lib/colors'
import { cn } from '../../lib/cn'

/**
 * Small pill displaying an event title on a day cell.
 * Props: event, onClick
 */
export function EventChip({ event, onClick }) {
  const { soft } = colorClasses(event.color)

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(event) }}
      className={cn(
        'w-full truncate rounded px-1.5 py-0.5 text-left text-xs font-medium transition-opacity hover:opacity-80',
        soft,
      )}
      title={event.title}
    >
      {event.title}
    </button>
  )
}
