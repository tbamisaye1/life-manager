// Date + deadline formatting. The deadline helper drives the Notion-style
// "Overdue by N days" / "Due in N days" badges the user specifically wants.
import {
  format,
  formatDistanceStrict,
  isToday,
  isTomorrow,
  isYesterday,
  differenceInCalendarDays,
  parseISO,
} from 'date-fns'

const toDate = (value) => (value instanceof Date ? value : parseISO(value))

export const hasTimeComponent = (value) => typeof value === 'string' && value.includes('T')

/** Default when a due is "that day" with no explicit time (11:00 PM). */
export const END_OF_DAY_TIME = '23:00'

/** Sort key: date-only dues count as end-of-day so morning times rank first. */
export function dueSortKey(due) {
  if (!due) return '\uffff'
  if (!hasTimeComponent(due)) return `${String(due).slice(0, 10)}T${END_OF_DAY_TIME}:00`
  return String(due)
}

export function formatDate(value, fmt = 'MMM d, yyyy') {
  if (!value) return ''
  try { return format(toDate(value), fmt) } catch { return '' }
}

export function formatTime(value) {
  if (!value) return ''
  try { return format(toDate(value), 'h:mm a') } catch { return '' }
}

/** Human due-date label, e.g. "Today", "Tomorrow, 9:25 AM", "Jun 14". */
export function dueLabel(value, hasTime = hasTimeComponent(value)) {
  if (!value) return 'No date'
  const d = toDate(value)
  const base = isToday(d) ? 'Today' : isTomorrow(d) ? 'Tomorrow' : isYesterday(d) ? 'Yesterday' : format(d, 'MMM d')
  return hasTime ? `${base}, ${format(d, 'h:mm a')}` : base
}

/**
 * Deadline status for badges.
 * Returns { tone, label } where tone ∈ overdue | urgent | soon | upcoming | none | done.
 */
export function deadlineStatus(value, { done = false } = {}) {
  if (done) return { tone: 'done', label: 'Done' }
  if (!value) return { tone: 'none', label: 'No deadline' }
  const d = toDate(value)
  const days = differenceInCalendarDays(d, new Date())
  const timed = hasTimeComponent(value)
  const timeBit = timed ? `, ${format(d, 'h:mm a')}` : ''
  if (days < 0) {
    const abs = formatDistanceStrict(d, new Date(), { unit: 'day' })
    return { tone: 'overdue', label: `Overdue by ${abs}${timeBit}` }
  }
  if (days === 0) return { tone: 'urgent', label: `Due today${timeBit}` }
  if (days === 1) return { tone: 'soon', label: `Due tomorrow${timeBit}` }
  if (days <= 6) return { tone: 'soon', label: `Due in ${days} days${timeBit}` }
  return { tone: 'upcoming', label: `Due in ${days} days${timeBit}` }
}

/** Value for <input type="datetime-local">. Date-only → end of day so order stays correct. */
export function toDueInputValue(iso) {
  if (!iso) return ''
  if (iso.includes('T')) return iso.slice(0, 16)
  return `${iso.slice(0, 10)}T${END_OF_DAY_TIME}`
}
