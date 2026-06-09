import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '../ui'
import { IconButton } from '../ui'

/**
 * Month/year label + prev/next navigation + Today button.
 * Props: currentMonth (Date), onPrev, onNext, onToday
 */
export function CalendarHeader({ currentMonth, onPrev, onNext, onToday }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-lg font-semibold text-zinc-900">
        {format(currentMonth, 'MMMM yyyy')}
      </h2>

      <div className="flex items-center gap-1">
        <Button size="sm" onClick={onToday}>Today</Button>
        <IconButton label="Previous month" onClick={onPrev}>
          <ChevronLeft className="h-4 w-4" />
        </IconButton>
        <IconButton label="Next month" onClick={onNext}>
          <ChevronRight className="h-4 w-4" />
        </IconButton>
      </div>
    </div>
  )
}
