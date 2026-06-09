import { useCallback, useEffect, useRef, useState } from 'react'
import { format, isToday, isSameDay } from 'date-fns'
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

const DRAG_THRESHOLD = 8

/**
 * 7-column week grid (Mon–Sun).
 * Props:
 *   weekDays    – array of 7 Date objects (Mon … Sun)
 *   events      – all timed events for the visible week
 *   onOpen      – fn(event)
 *   onCreateAt  – fn(startDate, endDate?)
 */
export function WeekTimeline({ weekDays, events = [], onOpen, onCreateAt }) {
  const containerRef = useRef(null)

  const { startMinutes, totalMinutes, gridHeight, hours } = useTimelineRange(events)

  // Current time
  const [nowMinutes, setNowMinutes] = useState(() => {
    const n = new Date()
    return n.getHours() * 60 + n.getMinutes()
  })
  useEffect(() => {
    const id = setInterval(() => {
      const n = new Date()
      setNowMinutes(n.getHours() * 60 + n.getMinutes())
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  const nowTop = ((nowMinutes - startMinutes) / totalMinutes) * gridHeight

  // Scroll to current time (or 8 AM) on mount
  useEffect(() => {
    if (!containerRef.current) return
    const todayInView = weekDays.some((d) => isToday(d))
    const scrollTo = todayInView
      ? Math.max(0, nowTop - 80)
      : ((8 * 60 - startMinutes) / totalMinutes) * gridHeight - 80
    containerRef.current.scrollTop = Math.max(0, scrollTo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Partition events per day
  const eventsByDay = weekDays.map((day) =>
    events.filter((ev) => {
      const d = typeof ev.start === 'string' ? new Date(ev.start) : ev.start
      return isSameDay(d, day)
    })
  )

  // Per-column drag state
  const dragRef = useRef(null) // { colIdx, startY, moved }
  const [dragSel, setDragSel] = useState(null) // { colIdx, top, height }

  const getColGridY = useCallback((clientY, colEl) => {
    if (!colEl) return 0
    const rect = colEl.getBoundingClientRect()
    const scrollOffset = containerRef.current?.scrollTop ?? 0
    return clientY - rect.top + scrollOffset
  }, [])

  const makeMouseDown = (colIdx) => (e) => {
    if (e.button !== 0) return
    if (e.target !== e.currentTarget) return
    e.preventDefault()
    const y = getColGridY(e.clientY, e.currentTarget)
    dragRef.current = { colIdx, startY: y, moved: false, el: e.currentTarget }
    setDragSel(null)
  }

  const handleMouseMove = useCallback((e) => {
    if (!dragRef.current) return
    const y = getColGridY(e.clientY, dragRef.current.el)
    const dy = y - dragRef.current.startY
    if (!dragRef.current.moved && Math.abs(dy) < DRAG_THRESHOLD) return
    dragRef.current.moved = true
    const top = Math.min(dragRef.current.startY, y)
    const height = Math.max(Math.abs(dy), 4)
    setDragSel({ colIdx: dragRef.current.colIdx, top, height })
  }, [getColGridY])

  const handleMouseUp = useCallback((e) => {
    if (!dragRef.current) return
    const { colIdx, startY, moved, el } = dragRef.current
    dragRef.current = null
    setDragSel(null)

    const endY = getColGridY(e.clientY, el)
    const day = weekDays[colIdx]
    const metrics = { startMinutes, totalMinutes, gridHeight }

    if (moved) {
      const rawTop = Math.min(startY, endY)
      const rawBot = Math.max(startY, endY)
      onCreateAt(yToDate(rawTop, day, metrics), yToDate(rawBot, day, metrics))
    } else {
      onCreateAt(yToDate(startY, day, metrics))
    }
  }, [getColGridY, weekDays, startMinutes, totalMinutes, gridHeight, onCreateAt])

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
      {/* Sticky column headers */}
      <div className="sticky top-0 z-20 flex border-b border-zinc-200 bg-white">
        {/* Gutter spacer */}
        <div className="flex-shrink-0" style={{ width: '52px' }} />
        {weekDays.map((day) => {
          const today = isToday(day)
          return (
            <div
              key={day.toISOString()}
              className="flex flex-1 flex-col items-center py-1.5 border-l border-zinc-100"
            >
              <span className={cn(
                'text-[11px] font-semibold uppercase tracking-wide',
                today ? 'text-accent-600' : 'text-zinc-400',
              )}>
                {format(day, 'EEE')}
              </span>
              <span className={cn(
                'text-sm font-semibold leading-tight',
                today ? 'text-accent-600' : 'text-zinc-700',
              )}>
                {format(day, 'd')}
              </span>
            </div>
          )
        })}
      </div>

      {/* Grid body */}
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

        {/* Day columns */}
        {weekDays.map((day, colIdx) => {
          const dayEvents = eventsByDay[colIdx]
          const laidOut = computeLayout(dayEvents)
          const todayInCol = isToday(day)
          const isDragCol = dragSel?.colIdx === colIdx

          return (
            <div
              key={day.toISOString()}
              className="relative flex-1 select-none border-l border-zinc-100"
              style={{ height: gridHeight }}
            >
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

              {/* Half-hour ticks */}
              {hours.map((h, i) => (
                <div
                  key={`${h}-half`}
                  style={{ top: i * HOUR_PX + HOUR_PX / 2 }}
                  className="pointer-events-none absolute inset-x-0 border-t border-dashed border-zinc-100"
                />
              ))}

              {/* Today column tint */}
              {todayInCol && (
                <div className="pointer-events-none absolute inset-0 bg-accent-50/40" />
              )}

              {/* Clickable / draggable grid bg */}
              <div
                data-grid
                className="absolute inset-0 cursor-crosshair"
                onMouseDown={makeMouseDown(colIdx)}
              />

              {/* Drag selection overlay */}
              {isDragCol && dragSel && (
                <div
                  className="pointer-events-none absolute inset-x-0.5 z-10 rounded-md bg-accent-500/20 border border-accent-500/40"
                  style={{ top: dragSel.top, height: dragSel.height }}
                />
              )}

              {/* Event blocks */}
              {laidOut.map((event) => {
                const startMin = toMinutes(event.start)
                const endMin = event.end ? toMinutes(event.end) : startMin + 30
                const durationMin = Math.max(endMin - startMin, 15)
                const top = ((startMin - startMinutes) / totalMinutes) * gridHeight
                const height = Math.max((durationMin / totalMinutes) * gridHeight, 28)
                const LEFT_PADDING = 1
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

              {/* Current time line for today's column */}
              {todayInCol && nowTop >= 0 && nowTop <= gridHeight && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
                  style={{ top: nowTop }}
                >
                  <div className="h-2 w-2 -translate-x-1 rounded-full bg-accent-600" />
                  <div className="h-px flex-1 bg-accent-600" />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
