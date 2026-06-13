import { ChevronLeft, ChevronRight, Plus, RefreshCw } from 'lucide-react'
import { format, isToday, startOfWeek, endOfWeek } from 'date-fns'
import { Button, IconButton } from '../ui'
import { cn } from '../../lib/cn'

/**
 * Combined schedule toolbar: Day/Week segmented toggle, date label, nav, New event button.
 * Props:
 *   view        – 'day' | 'week'
 *   onViewChange – fn('day' | 'week')
 *   anchorDate  – Date (the viewed day in day-mode, week-start in week-mode)
 *   onPrev      – step backward
 *   onNext      – step forward
 *   onToday     – jump to today/this-week
 *   onNewEvent  – open create modal
 */
export function ScheduleToolbar({ view, onViewChange, anchorDate, onPrev, onNext, onToday, onNewEvent, onSync, syncing = false }) {
  const todayActive = view === 'day' ? isToday(anchorDate) : isThisWeek(anchorDate)

  const dateLabel = view === 'day'
    ? format(anchorDate, 'EEEE, MMMM d, yyyy')
    : weekRangeLabel(anchorDate)

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      {/* Left: segmented control + date label */}
      <div className="flex items-center gap-3">
        {/* Segmented control */}
        <div className="flex items-center rounded-lg border border-zinc-200 bg-zinc-50 p-0.5">
          {(['day', 'week']).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onViewChange(v)}
              className={cn(
                'h-7 rounded-md px-3 text-sm font-medium capitalize transition-colors',
                view === v
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-700',
              )}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Date label */}
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-base font-semibold',
            todayActive ? 'text-accent-600' : 'text-zinc-800',
          )}>
            {dateLabel}
          </span>
          {todayActive && (
            <span className="rounded-full bg-accent-100 px-2 py-0.5 text-xs font-medium text-accent-600">
              Today
            </span>
          )}
        </div>
      </div>

      {/* Right: nav + New event */}
      <div className="flex items-center gap-1.5">
        {onSync && (
          <IconButton label="Sync Google calendars" onClick={onSync} disabled={syncing}>
            <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} />
          </IconButton>
        )}
        <Button size="sm" onClick={onToday}>Today</Button>
        <IconButton label={view === 'day' ? 'Previous day' : 'Previous week'} onClick={onPrev}>
          <ChevronLeft className="h-4 w-4" />
        </IconButton>
        <IconButton label={view === 'day' ? 'Next day' : 'Next week'} onClick={onNext}>
          <ChevronRight className="h-4 w-4" />
        </IconButton>

        <div className="ml-2">
          <Button variant="primary" size="sm" onClick={onNewEvent}>
            <Plus className="h-4 w-4" />
            New event
          </Button>
        </div>
      </div>
    </div>
  )
}

/** True if the given date falls in the current ISO calendar week (Mon-first). */
function isThisWeek(date) {
  const today = new Date()
  const wStart = startOfWeek(today, { weekStartsOn: 1 })
  const wEnd = endOfWeek(today, { weekStartsOn: 1 })
  return date >= wStart && date <= wEnd
}

/** "Jun 9 – Jun 15, 2026" style label for a week anchor. */
function weekRangeLabel(anchorDate) {
  const start = startOfWeek(anchorDate, { weekStartsOn: 1 })
  const end = endOfWeek(anchorDate, { weekStartsOn: 1 })
  const sameMonth = start.getMonth() === end.getMonth()
  const sameYear = start.getFullYear() === end.getFullYear()
  if (sameMonth) {
    return `${format(start, 'MMM d')}–${format(end, 'd, yyyy')}`
  }
  if (sameYear) {
    return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`
  }
  return `${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`
}
