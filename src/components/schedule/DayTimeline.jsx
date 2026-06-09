import { useEffect, useRef, useState } from 'react'
import { parseISO, isToday, set as setDate } from 'date-fns'
import { cn } from '../../lib/cn'
import { ScheduleBlock } from './ScheduleBlock'

const HOUR_PX = 56
const DEFAULT_START_HOUR = 6   // 6 AM
const DEFAULT_END_HOUR = 23    // 11 PM

/** Convert a Date (or ISO string) to total minutes since midnight. */
function toMinutes(value) {
  const d = value instanceof Date ? value : parseISO(value)
  return d.getHours() * 60 + d.getMinutes()
}

/**
 * Compute non-overlapping column layout for events.
 * Returns events with extra `_col` and `_cols` fields.
 */
function computeLayout(events) {
  if (!events.length) return []

  // Sort by start
  const sorted = [...events].sort((a, b) => toMinutes(a.start) - toMinutes(b.start))

  // Group overlapping events into clusters
  const columns = []
  const placed = sorted.map((ev) => {
    const startMin = toMinutes(ev.start)
    const endMin = toMinutes(ev.end || ev.start) || startMin + 30

    // Find first column with no overlap
    let col = 0
    while (
      col < columns.length &&
      columns[col].some((o) => {
        const oStart = toMinutes(o.start)
        const oEnd = toMinutes(o.end || o.start) || oStart + 30
        return startMin < oEnd && endMin > oStart
      })
    ) {
      col++
    }
    if (!columns[col]) columns[col] = []
    columns[col].push(ev)
    return { ev, col }
  })

  const totalCols = columns.length

  // Map back, computing how many cols the block spans (greedy: fill remaining)
  return placed.map(({ ev, col }) => {
    // Find furthest column it can span without overlap
    let span = 1
    for (let c = col + 1; c < totalCols; c++) {
      const startMin = toMinutes(ev.start)
      const endMin = toMinutes(ev.end || ev.start) || startMin + 30
      const conflict = columns[c].some((o) => {
        const oStart = toMinutes(o.start)
        const oEnd = toMinutes(o.end || o.start) || oStart + 30
        return startMin < oEnd && endMin > oStart
      })
      if (conflict) break
      span++
    }
    return { ...ev, _col: col, _cols: totalCols, _span: span }
  })
}

/**
 * Vertical hour timeline for a single day.
 * Props:
 *   day         – Date representing the day
 *   events      – timed events (not all-day) for this day
 *   onOpen      – fn(event)
 *   onCreateAt  – fn(Date) — called with an approximate start time
 */
export function DayTimeline({ day, events = [], onOpen, onCreateAt }) {
  const isCurrentDay = isToday(day)
  const containerRef = useRef(null)

  // Determine visible hour range — expand to fit any out-of-range events
  const eventMins = events.map((e) => ({
    start: toMinutes(e.start),
    end: e.end ? toMinutes(e.end) : toMinutes(e.start) + 30,
  }))

  const minHour = eventMins.length
    ? Math.min(DEFAULT_START_HOUR, Math.floor(Math.min(...eventMins.map((e) => e.start)) / 60))
    : DEFAULT_START_HOUR
  const maxHour = eventMins.length
    ? Math.max(DEFAULT_END_HOUR, Math.ceil(Math.max(...eventMins.map((e) => e.end)) / 60))
    : DEFAULT_END_HOUR

  const startMinutes = minHour * 60
  const totalMinutes = (maxHour - minHour) * 60
  const gridHeight = (maxHour - minHour) * HOUR_PX

  // Current time line position
  const [nowMinutes, setNowMinutes] = useState(() => {
    const n = new Date()
    return n.getHours() * 60 + n.getMinutes()
  })

  useEffect(() => {
    if (!isCurrentDay) return
    const id = setInterval(() => {
      const n = new Date()
      setNowMinutes(n.getHours() * 60 + n.getMinutes())
    }, 60_000)
    return () => clearInterval(id)
  }, [isCurrentDay])

  const nowTop = isCurrentDay
    ? ((nowMinutes - startMinutes) / totalMinutes) * gridHeight
    : null

  // Scroll to show current time (or 8 AM) on mount
  useEffect(() => {
    if (!containerRef.current) return
    const scrollTo = isCurrentDay
      ? Math.max(0, nowTop - 80)
      : ((8 * 60 - startMinutes) / totalMinutes) * gridHeight - 80
    containerRef.current.scrollTop = Math.max(0, scrollTo)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hours = Array.from({ length: maxHour - minHour }, (_, i) => minHour + i)

  const laidOut = computeLayout(events)

  const handleGridClick = (e) => {
    if (e.target !== e.currentTarget) return
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const clickedMinutes = Math.round((y / gridHeight) * totalMinutes + startMinutes)
    const hours = Math.floor(clickedMinutes / 60)
    const mins = Math.round((clickedMinutes % 60) / 15) * 15 // snap to 15 min
    const date = setDate(day, { hours, minutes: mins, seconds: 0, milliseconds: 0 })
    onCreateAt(date)
  }

  return (
    <div
      ref={containerRef}
      className="relative overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-sm"
      style={{ maxHeight: '70vh' }}
    >
      <div className="flex">
        {/* Hour gutter */}
        <div className="sticky left-0 z-10 flex-shrink-0 bg-white" style={{ width: '52px' }}>
          <div style={{ height: gridHeight }}>
            {hours.map((h) => (
              <div
                key={h}
                style={{ height: HOUR_PX }}
                className="relative flex items-start justify-end pr-2"
              >
                <span className="mt-[-0.45em] text-[11px] font-medium text-zinc-500 select-none">
                  {h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline area */}
        <div className="relative flex-1 select-none" style={{ height: gridHeight }}>
          {/* Hour lines */}
          {hours.map((h, i) => (
            <div
              key={h}
              style={{ top: i * HOUR_PX }}
              className={cn(
                'pointer-events-none absolute inset-x-0 border-t',
                i === 0 ? 'border-zinc-200' : 'border-zinc-100',
              )}
            />
          ))}

          {/* Half-hour tick lines */}
          {hours.map((h, i) => (
            <div
              key={`${h}-half`}
              style={{ top: i * HOUR_PX + HOUR_PX / 2 }}
              className="pointer-events-none absolute inset-x-0 border-t border-dashed border-zinc-100"
            />
          ))}

          {/* Clickable grid background */}
          <div
            className="absolute inset-0 cursor-crosshair"
            onClick={handleGridClick}
          />

          {/* Positioned event blocks */}
          {laidOut.map((event) => {
            const startMin = toMinutes(event.start)
            const endMin = event.end ? toMinutes(event.end) : startMin + 30
            const durationMin = Math.max(endMin - startMin, 15) // minimum visible height

            const top = ((startMin - startMinutes) / totalMinutes) * gridHeight
            const height = Math.max((durationMin / totalMinutes) * gridHeight, 32)

            const LEFT_PADDING = 2
            const colWidth = (1 / event._cols) * 100
            const left = `calc(${event._col * colWidth}% + ${LEFT_PADDING}px)`
            const width = `calc(${(colWidth * event._span)}% - ${LEFT_PADDING * 2}px)`

            return (
              <ScheduleBlock
                key={event.id}
                event={event}
                style={{ top, height, left, width }}
                onClick={onOpen}
              />
            )
          })}

          {/* Current time indicator */}
          {nowTop !== null && nowTop >= 0 && nowTop <= gridHeight && (
            <div
              className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
              style={{ top: nowTop }}
            >
              <div className="h-2 w-2 -translate-x-1 rounded-full bg-accent-600" />
              <div className="h-px flex-1 bg-accent-600" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
