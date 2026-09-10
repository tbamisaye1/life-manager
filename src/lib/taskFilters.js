import { differenceInCalendarDays, parseISO } from 'date-fns'

// Pure helpers for bucketing tasks by deadline (+ homework). Kept separate from
// UI so Today, Tasks, Projects, and mobile can share the same rules.
const daysUntil = (due) => differenceInCalendarDays(parseISO(due), new Date())

export const CUSTOM_DAYS_MIN = 1
export const CUSTOM_DAYS_MAX = 30
export const NEXT_SCOPES = ['all', 'tasks', 'homework']

function isHomework(task) {
  return Number(task.is_homework) === 1 || task.is_homework === true
}

/** Parse `next_3` / `tasks_next_3` / `homework_next_3` (and legacy hw_ aliases). */
export function parseNextFilter(filter) {
  const m = String(filter || '').match(/^(?:(homework|hw|tasks)_)?next_(\d+)$/)
  if (!m) return null
  const days = Number(m[2])
  if (!Number.isFinite(days) || days < CUSTOM_DAYS_MIN || days > CUSTOM_DAYS_MAX) return null
  const prefix = m[1]
  const scope = prefix === 'homework' || prefix === 'hw' ? 'homework' : prefix === 'tasks' ? 'tasks' : 'all'
  return { days, scope, homework: scope === 'homework', key: nextFilterKey(days, scope) }
}

export function nextFilterKey(days, scope = 'all') {
  const n = Math.min(CUSTOM_DAYS_MAX, Math.max(CUSTOM_DAYS_MIN, Number(days) || 1))
  const s = NEXT_SCOPES.includes(scope) ? scope : 'all'
  if (s === 'homework') return `homework_next_${n}`
  if (s === 'tasks') return `tasks_next_${n}`
  return `next_${n}`
}

export function isValidTaskFilter(filter, presetKeys = []) {
  if (presetKeys.includes(filter)) return true
  return parseNextFilter(filter) != null
}

export function matchesFilter(task, filter) {
  if (filter === 'done') return task.status === 'done'
  if (task.status === 'done') return false // active filters exclude completed
  if (filter === 'all') return true
  if (filter === 'homework') return isHomework(task)

  const next = parseNextFilter(filter)
  if (next) {
    if (next.scope === 'homework' && !isHomework(task)) return false
    if (next.scope === 'tasks' && isHomework(task)) return false
    if (!task.due_date) return false
    const d = daysUntil(task.due_date)
    return d >= 0 && d <= next.days
  }

  const hwOnly =
    filter === 'homework_tonight' ||
    filter === 'homework_week' ||
    filter === 'hw_tonight' ||
    filter === 'hw_week'
  if (hwOnly && !isHomework(task)) return false

  if (!task.due_date) {
    if (filter === 'upcoming') return false
    if (filter === 'homework') return isHomework(task)
    return filter === 'all'
  }

  const d = daysUntil(task.due_date)
  switch (filter) {
    case 'overdue':
      return d < 0
    case 'today':
    case 'tonight':
      return d === 0
    case 'week':
      return d >= 0 && d <= 7
    case 'upcoming':
      return d > 0
    case 'homework_tonight':
    case 'hw_tonight':
      return d === 0
    case 'homework_week':
    case 'hw_week':
      return d >= 0 && d <= 7
    default:
      return true
  }
}

export function filterTasks(tasks, filter) {
  return tasks.filter((t) => matchesFilter(t, filter))
}

export function countForFilter(tasks, filter) {
  return tasks.filter((t) => matchesFilter(t, filter)).length
}

export function taskCounts(tasks) {
  return {
    all: tasks.filter((t) => t.status !== 'done').length,
    overdue: tasks.filter((t) => matchesFilter(t, 'overdue')).length,
    tonight: tasks.filter((t) => matchesFilter(t, 'tonight')).length,
    week: tasks.filter((t) => matchesFilter(t, 'week')).length,
    homework: tasks.filter((t) => matchesFilter(t, 'homework')).length,
    homework_tonight: tasks.filter((t) => matchesFilter(t, 'homework_tonight')).length,
    homework_week: tasks.filter((t) => matchesFilter(t, 'homework_week')).length,
    done: tasks.filter((t) => t.status === 'done').length,
  }
}
