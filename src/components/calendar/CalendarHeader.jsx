import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '../ui'
import { IconButton } from '../ui'
import { cn } from '../../lib/cn'

/**
 * Month/year label + prev/next navigation + Today button.
 * Props: currentMonth (Date), onPrev, onNext, onToday,
 *        onSync (optional — pull latest from Google), syncing (spinner state)
 */
export function CalendarHeader({ currentMonth, onPrev, onNext, onToday, onSync, syncing = false }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-lg font-semibold text-zinc-900">
        {format(currentMonth, 'MMMM yyyy')}
      </h2>

      <div className="flex items-center gap-1">
        {onSync && (
          <IconButton label="Sync Google calendars" onClick={onSync} disabled={syncing}>
            <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} />
          </IconButton>
        )}
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
