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

export function formatDate(value, fmt = 'MMM d, yyyy') {
  if (!value) return ''
  try { return format(toDate(value), fmt) } catch { return '' }
}

export function formatTime(value) {
  if (!value) return ''
  try { return format(toDate(value), 'h:mm a') } catch { return '' }
}

/** Human due-date label, e.g. "Today", "Tomorrow", "Jun 14". */
export function dueLabel(value, hasTime = false) {
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
  if (days < 0) {
    const abs = formatDistanceStrict(d, new Date(), { unit: 'day' })
    return { tone: 'overdue', label: `Overdue by ${abs}` }
  }
  if (days === 0) return { tone: 'urgent', label: 'Due today' }
  if (days === 1) return { tone: 'soon', label: 'Due tomorrow' }
  if (days <= 6) return { tone: 'soon', label: `Due in ${days} days` }
  return { tone: 'upcoming', label: `Due in ${days} days` }
}

export const hasTimeComponent = (value) => typeof value === 'string' && value.includes('T')
