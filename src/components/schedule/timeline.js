/**
 * Shared timeline layout helpers for DayTimeline and WeekTimeline.
 */
import { parseISO, set as setDate, format } from 'date-fns'

export const HOUR_PX = 56
export const DEFAULT_START_HOUR = 6   // 6 AM
export const DEFAULT_END_HOUR = 23    // 11 PM

/** Convert a Date (or ISO string) to total minutes since midnight. */
export function toMinutes(value) {
  const d = value instanceof Date ? value : parseISO(value)
  return d.getHours() * 60 + d.getMinutes()
}

/**
 * Derive the visible hour range from a set of events.
 * Returns { minHour, maxHour, startMinutes, totalMinutes, gridHeight, hours }.
 */
export function useTimelineRange(events = []) {
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
  const hours = Array.from({ length: maxHour - minHour }, (_, i) => minHour + i)

  return { minHour, maxHour, startMinutes, totalMinutes, gridHeight, hours }
}

/**
 * Format hour number as a label, e.g. 0→"12 AM", 13→"1 PM".
 */
export function hourLabel(h) {
  if (h === 0) return '12 AM'
  if (h < 12) return `${h} AM`
  if (h === 12) return '12 PM'
  return `${h - 12} PM`
}

/**
 * Given a raw Y offset and grid metrics, return a Date snapped to 15-min.
 */
export function yToDate(y, day, { startMinutes, totalMinutes, gridHeight }) {
  const clickedMinutes = Math.round((y / gridHeight) * totalMinutes + startMinutes)
  const hrs = Math.floor(clickedMinutes / 60)
  const mins = Math.round((clickedMinutes % 60) / 15) * 15
  return setDate(day, { hours: hrs, minutes: mins, seconds: 0, milliseconds: 0 })
}

/**
 * Compute non-overlapping column layout for events.
 * Returns events augmented with _col, _cols, _span fields.
 */
export function computeLayout(events) {
  if (!events.length) return []

  const sorted = [...events].sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
  const columns = []

  const placed = sorted.map((ev) => {
    const startMin = toMinutes(ev.start)
    const endMin = toMinutes(ev.end || ev.start) || startMin + 30

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

  return placed.map(({ ev, col }) => {
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

/** Format a Date as "yyyy-MM-dd'T'HH:mm" for modal prefill. */
export function toISOLocal(date) {
  return format(date, "yyyy-MM-dd'T'HH:mm")
}
