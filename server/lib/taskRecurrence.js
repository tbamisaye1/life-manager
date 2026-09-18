/**
 * Task recurrence: legacy enum strings plus optional weekday sets.
 *
 * Stored in tasks.recurrence (TEXT):
 *   - "single" | "daily" | "weekly" | "monthly" | "yearly"  (legacy / simple)
 *   - JSON {"frequency":"weekly","weekdays":[1,5,6,0]}      (days matter)
 *
 * Weekdays use the same 0=Sun..6=Sat convention as events / Google BYDAY.
 * Tasks are single-row: completing one rolls due_date to the next match.
 */

const FREQUENCIES = new Set(['single', 'daily', 'weekly', 'monthly', 'yearly'])
const DOW_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const DOW_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function normalizeWeekdays(raw) {
  if (!Array.isArray(raw) || !raw.length) return null
  const out = []
  for (const v of raw) {
    let n = v
    if (typeof v === 'string') {
      const key = v.trim().toLowerCase().slice(0, 3)
      const idx = DOW_NAMES.indexOf(key)
      if (idx < 0) continue
      n = idx
    }
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > 6) continue
    if (!out.includes(n)) out.push(n)
  }
  return out.length ? out.sort((a, b) => a - b) : null
}

/**
 * @returns {{ frequency: string, weekdays: number[]|null }}
 */
export function parseRecurrence(value) {
  if (value == null || value === '') return { frequency: 'single', weekdays: null }
  if (typeof value === 'object' && !Array.isArray(value)) {
    const frequency = FREQUENCIES.has(value.frequency) ? value.frequency : 'weekly'
    return { frequency, weekdays: normalizeWeekdays(value.weekdays ?? value.days_of_week) }
  }
  if (typeof value !== 'string') return { frequency: 'single', weekdays: null }
  const trimmed = value.trim()
  if (FREQUENCIES.has(trimmed)) return { frequency: trimmed, weekdays: null }
  if (trimmed.startsWith('{')) {
    try {
      return parseRecurrence(JSON.parse(trimmed))
    } catch {
      return { frequency: 'single', weekdays: null }
    }
  }
  // Compact form: weekly:1,5,6,0 or weekly:mon,fri,sat,sun
  const m = trimmed.match(/^(daily|weekly|monthly|yearly):(.+)$/i)
  if (m) {
    const parts = m[2].split(/[,\s]+/).filter(Boolean)
    return { frequency: m[1].toLowerCase(), weekdays: normalizeWeekdays(parts) }
  }
  return { frequency: 'single', weekdays: null }
}

/**
 * Persist form for the TEXT column. Plain enum when no weekdays; JSON otherwise.
 */
export function serializeRecurrence(input) {
  const { frequency, weekdays } = parseRecurrence(input)
  if (frequency === 'single' || !frequency) return 'single'
  if (!weekdays?.length) return frequency
  return JSON.stringify({ frequency, weekdays })
}

/** Build storage value from MCP/HTTP fields. `daysOfWeek: undefined` keeps existing weekdays from recurrence; `[]` clears them. */
export function encodeRecurrenceFields(recurrence, daysOfWeek) {
  const base = parseRecurrence(recurrence ?? 'single')
  const weekdays = daysOfWeek === undefined ? base.weekdays : normalizeWeekdays(daysOfWeek)
  let frequency = base.frequency
  // days without an explicit frequency → weekly (matches calendar event behavior)
  if (weekdays?.length && frequency === 'single') frequency = 'weekly'
  return serializeRecurrence({ frequency, weekdays })
}

export function isRecurring(value) {
  const { frequency } = parseRecurrence(value)
  return frequency !== 'single'
}

/**
 * Advance a due date by one occurrence, preserving date-only vs timed ISO.
 * With weekdays, walks forward day-by-day to the next matching weekday.
 */
export function advanceDue(due, recurrence) {
  const { frequency, weekdays } = parseRecurrence(recurrence)
  const dateOnly = !due || due.length <= 10
  const base = due ? new Date(dateOnly ? `${due.slice(0, 10)}T12:00:00` : due) : new Date()

  if (weekdays?.length) {
    // Start tomorrow (or next minute after a timed due) and find the next match.
    const cur = new Date(base)
    cur.setDate(cur.getDate() + 1)
    for (let i = 0; i < 8; i++) {
      if (weekdays.includes(cur.getDay())) {
        return formatDue(cur, due, dateOnly)
      }
      cur.setDate(cur.getDate() + 1)
    }
    // Should be unreachable if weekdays is non-empty.
    return formatDue(cur, due, dateOnly)
  }

  if (frequency === 'monthly') base.setMonth(base.getMonth() + 1)
  else if (frequency === 'yearly') base.setFullYear(base.getFullYear() + 1)
  else if (frequency === 'weekly') base.setDate(base.getDate() + 7)
  else base.setDate(base.getDate() + 1) // daily
  return formatDue(base, due, dateOnly)
}

function formatDue(d, originalDue, dateOnly) {
  if (dateOnly) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  // Preserve clock time from the original timed due when possible.
  if (originalDue && originalDue.includes('T')) {
    const time = originalDue.slice(11)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}T${time}`
  }
  return d.toISOString()
}

export function formatRecurrenceLabel(value) {
  const { frequency, weekdays } = parseRecurrence(value)
  if (frequency === 'single') return null
  const freqLabel = frequency[0].toUpperCase() + frequency.slice(1)
  if (!weekdays?.length) return freqLabel
  const days = weekdays.map((d) => DOW_LABEL[d]).join(', ')
  return `${freqLabel} · ${days}`
}

export const RECURRENCE_FREQUENCIES = ['single', 'daily', 'weekly', 'monthly', 'yearly']
export { DOW_NAMES, DOW_LABEL }
