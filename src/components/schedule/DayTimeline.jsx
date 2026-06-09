import { useCallback, useEffect, useRef, useState } from 'react'
import { isToday } from 'date-fns'
import { cn } from '../../lib/cn'
import { ScheduleBlock } from './ScheduleBlock'
import {
  HOUR_PX,
  useTimelineRange,
  hourLabel,
  yToDate,
  computeLayout,
  toMinutes,
} from './timeline'

/** Minimum drag distance (px) before it's treated as a drag rather than a click. */
const DRAG_THRESHOLD = 8

/**
 * Vertical hour timeline for a single day.
 * Props:
 *   day         – Date representing the day
 *   events      – timed events (not all-day) for this day
 *   onOpen      – fn(event)
 *   onCreateAt  – fn(startDate, endDate?) — single click passes only start; drag passes both
 */
export function DayTimeline({ day, events = [], onOpen, onCreateAt }) {
  const isCurrentDay = isToday(day)
  const containerRef = useRef(null)

  const { startMinutes, totalMinutes, gridHeight, hours } = useTimelineRange(events)

  // Current time indicator
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
      ? Math.max(0, ((nowMinutes - startMinutes) / totalMinutes) * gridHeight - 80)
      : ((8 * 60 - startMinutes) / totalMinutes) * gridHeight - 80
    containerRef.current.scrollTop = Math.max(0, scrollTo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const laidOut = computeLayout(events)

  // --- Drag-to-create state ---
  const dragRef = useRef(null) // { startY, scrollTop }
  const [dragSel, setDragSel] = useState(null) // { top, height } in px, or null

  const getGridY = useCallback((clientY) => {
    const el = containerRef.current?.querySelector('[data-grid]')
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    // Account for scroll within the container
    const scrollOffset = containerRef.current?.scrollTop ?? 0
    return clientY - rect.top + scrollOffset
  }, [])

  const handleMouseDown = useCallback((e) => {
    // Only left-button on the grid background (data-grid target)
    if (e.button !== 0) return
    if (e.target !== e.currentTarget) return
    e.preventDefault()
    const y = getGridY(e.clientY)
    dragRef.current = { startY: y, moved: false }
    setDragSel(null)
  }, [getGridY])

  const handleMouseMove = useCallback((e) => {
    if (!dragRef.current) return
    const y = getGridY(e.clientY)
    const dy = y - dragRef.current.startY
    if (!dragRef.current.moved && Math.abs(dy) < DRAG_THRESHOLD) return
    dragRef.current.moved = true

    const top = Math.min(dragRef.current.startY, y)
    const height = Math.max(Math.abs(dy), 4)
    setDragSel({ top, height })
  }, [getGridY])

  const handleMouseUp = useCallback((e) => {
    if (!dragRef.current) return
    const wasDrag = dragRef.current.moved
    const startY = dragRef.current.startY
    dragRef.current = null

    const endY = getGridY(e.clientY)
    const metrics = { startMinutes, totalMinutes, gridHeight }

    if (wasDrag) {
      const rawTop = Math.min(startY, endY)
      const rawBot = Math.max(startY, endY)
      const startDate = yToDate(rawTop, day, metrics)
      const endDate = yToDate(rawBot, day, metrics)
      setDragSel(null)
      onCreateAt(startDate, endDate)
    } else {
      // Plain click — keep backward-compat: only pass start
      const date = yToDate(startY, day, metrics)
      setDragSel(null)
      onCreateAt(date)
    }
  }, [getGridY, startMinutes, totalMinutes, gridHeight, day, onCreateAt])

  // Cancel drag on mouse-leave
  const handleMouseLeave = useCallback(() => {
    if (dragRef.current) {
      dragRef.current = null
      setDragSel(null)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-sm"
      style={{ maxHeight: '70vh' }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
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
                  {hourLabel(h)}
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

          {/* Clickable / draggable grid background */}
          <div
            data-grid
            className="absolute inset-0 cursor-crosshair"
            onMouseDown={handleMouseDown}
          />

          {/* Drag selection overlay */}
          {dragSel && (
            <div
              className="pointer-events-none absolute inset-x-1 z-10 rounded-md bg-accent-500/20 border border-accent-500/40"
              style={{ top: dragSel.top, height: dragSel.height }}
            />
          )}

          {/* Positioned event blocks */}
          {laidOut.map((event) => {
            const startMin = toMinutes(event.start)
            const endMin = event.end ? toMinutes(event.end) : startMin + 30
            const durationMin = Math.max(endMin - startMin, 15)

            const top = ((startMin - startMinutes) / totalMinutes) * gridHeight
            const height = Math.max((durationMin / totalMinutes) * gridHeight, 32)

            const LEFT_PADDING = 2
            const colWidth = (1 / event._cols) * 100
            const left = `calc(${event._col * colWidth}% + ${LEFT_PADDING}px)`
            const width = `calc(${colWidth * event._span}% - ${LEFT_PADDING * 2}px)`

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
