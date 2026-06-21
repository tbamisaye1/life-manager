/** Build/normalise timed event start/end, including overnight spans. */

const pad = (n) => String(n).padStart(2, '0')

function parseDateParts(iso) {
  const d = iso.slice(0, 10)
  const t = iso.length > 10 ? iso.slice(11, 16) : null
  return { date: d, time: t }
}

function addDaysToDate(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Compare HH:mm strings. Returns negative if a < b. */
export function compareTimes(a, b) {
  const [ah, am] = (a || '00:00').split(':').map(Number)
  const [bh, bm] = (b || '00:00').split(':').map(Number)
  return (ah * 60 + am) - (bh * 60 + bm)
}

/** Build start/end ISO strings for a timed event on a calendar date. Rolls end to the next day when end <= start. */
export function buildTimedRange(date, startTime, endTime) {
  const start = `${date}T${startTime}:00`
  const endDate = compareTimes(endTime, startTime) <= 0 ? addDaysToDate(date, 1) : date
  return { start, end: `${endDate}T${endTime}:00` }
}

/** If end is on the same day but before/equal to start, roll end to the next day. */
export function normalizeEventEnd(start, end) {
  if (!start || !end || start.length <= 10 || end.length <= 10) return end || start
  const { date: startDate, time: startTime } = parseDateParts(start)
  const { date: endDate, time: endTime } = parseDateParts(end)
  if (!startTime || !endTime) return end
  if (startDate === endDate && compareTimes(endTime, startTime) <= 0) {
    return `${addDaysToDate(startDate, 1)}T${end.slice(11)}`
  }
  return end
}
