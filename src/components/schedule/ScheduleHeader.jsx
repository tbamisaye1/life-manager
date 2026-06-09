import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format, isToday } from 'date-fns'
import { Button, IconButton } from '../ui'
import { cn } from '../../lib/cn'

/**
 * Single-day navigation header: date label + prev/next day + Today button.
 * Props: currentDay (Date), onPrev, onNext, onToday
 */
export function ScheduleHeader({ currentDay, onPrev, onNext, onToday }) {
  const today = isToday(currentDay)

  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-zinc-900">
          {format(currentDay, 'EEEE')}
        </h2>
        <span
          className={cn(
            'text-lg font-semibold',
            today ? 'text-accent-600' : 'text-zinc-400',
          )}
        >
          {format(currentDay, 'MMMM d, yyyy')}
        </span>
        {today && (
          <span className="rounded-full bg-accent-100 px-2 py-0.5 text-xs font-medium text-accent-600">
            Today
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button size="sm" onClick={onToday}>Today</Button>
        <IconButton label="Previous day" onClick={onPrev}>
          <ChevronLeft className="h-4 w-4" />
        </IconButton>
        <IconButton label="Next day" onClick={onNext}>
          <ChevronRight className="h-4 w-4" />
        </IconButton>
      </div>
    </div>
  )
}
