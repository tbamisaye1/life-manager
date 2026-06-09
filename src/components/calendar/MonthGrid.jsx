import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  parseISO,
} from 'date-fns'
import { DayCell } from './DayCell'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Parse event start to a JS Date, handling date-only strings. */
function eventDate(start) {
  if (!start) return new Date(NaN)
  try {
    return parseISO(start)
  } catch {
    return new Date(NaN)
  }
}

/** Bucket events by calendar day key "YYYY-MM-DD". */
function bucketEvents(events) {
  const map = {}
  for (const ev of events) {
    const d = eventDate(ev.start)
    if (isNaN(d)) continue
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (!map[key]) map[key] = []
    map[key].push(ev)
  }
  return map
}

function dayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/**
 * Full month grid: weekday header + 6×7 day cells.
 * Props: currentMonth (Date), events ([]), onAddEvent(date), onOpenEvent(event)
 */
export function MonthGrid({ currentMonth, events, onAddEvent, onOpenEvent }) {
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })
  const bucketed = bucketEvents(events)

  return (
    <div className="rounded-xl border border-zinc-200 overflow-hidden bg-white shadow-sm">
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-zinc-100">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="py-2 text-center text-xs font-semibold uppercase tracking-wide text-zinc-400"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {days.map((date) => (
          <DayCell
            key={date.toISOString()}
            date={date}
            events={bucketed[dayKey(date)] || []}
            isCurrentMonth={isSameMonth(date, currentMonth)}
            onAddEvent={onAddEvent}
            onOpenEvent={onOpenEvent}
          />
        ))}
      </div>
    </div>
  )
}
