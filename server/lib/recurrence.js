// Expand a recurrence spec into individual event occurrences. Used by both the
// /events/recurring HTTP route and the assistant's schedule_recurring_event tool
// so the logic stays in one place. Everything is local wall-clock time.

import { buildTimedRange } from './eventTimes.js'

const pad = (n) => String(n).padStart(2, '0')
const dateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

function addMinutesToClock(date, time, minutes) {
  const [h, m] = time.split(':').map(Number)
  const d = new Date(`${date}T00:00:00`)
  d.setHours(h, m + minutes, 0, 0)
  return `${dateStr(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`
}

const DEFAULT_HORIZON_DAYS = 60
const HARD_CAP = 366

/**
 * @param {object} spec
 *  - frequency: 'daily' | 'weekly'        (default 'weekly' if weekdays given, else 'daily')
 *  - weekdays: number[] (0=Sun..6=Sat)    occurrences only on these weekdays
 *  - startDate: 'YYYY-MM-DD'              (default: today)
 *  - untilDate: 'YYYY-MM-DD'              (optional end, inclusive)
 *  - occurrences: number                  (optional cap on count)
 *  - allDay: boolean
 *  - startTime / endTime: 'HH:mm'         (timed events)
 *  - durationMinutes: number              (used if endTime omitted; default 60)
 * @returns {{start:string,end:string}[]}
 */
export function expandRecurrence(spec) {
  const {
    frequency,
    weekdays,
    startDate,
    untilDate,
    occurrences,
    allDay = false,
    startTime = '09:00',
    endTime,
    durationMinutes = 60,
  } = spec

  const wd = Array.isArray(weekdays) && weekdays.length ? new Set(weekdays) : null
  const freq = frequency || (wd ? 'weekly' : 'daily')

  const start = new Date(`${(startDate || dateStr(new Date()))}T00:00:00`)
  const until = untilDate ? new Date(`${untilDate}T00:00:00`) : null
  const maxCount = occurrences && occurrences > 0 ? Math.min(occurrences, HARD_CAP) : HARD_CAP

  const out = []
  const cur = new Date(start)
  let daysScanned = 0
  while (out.length < maxCount && daysScanned <= 730) {
    if (until && cur > until) break
    if (!until && !occurrences && daysScanned > DEFAULT_HORIZON_DAYS) break

    const include = freq === 'daily' ? (wd ? wd.has(cur.getDay()) : true) : (wd ? wd.has(cur.getDay()) : true)
    if (include) {
      const ds = dateStr(cur)
      if (allDay) {
        out.push({ start: ds, end: ds })
      } else {
        const range = endTime
          ? buildTimedRange(ds, startTime, endTime)
          : { start: `${ds}T${startTime}:00`, end: addMinutesToClock(ds, startTime, durationMinutes) }
        out.push(range)
      }
    }
    cur.setDate(cur.getDate() + 1)
    daysScanned++
  }
  return out
}
