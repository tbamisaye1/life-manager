import { differenceInCalendarDays, parseISO } from 'date-fns'

// Pure helpers for bucketing tasks by deadline. Kept separate from UI so the
// logic is reusable (Today, Tasks, Projects) and easy to reason about.
const daysUntil = (due) => differenceInCalendarDays(parseISO(due), new Date())

export function matchesFilter(task, filter) {
  if (filter === 'done') return task.status === 'done'
  if (task.status === 'done') return false // active filters exclude completed
  if (filter === 'all') return true
  if (!task.due_date) return filter === 'upcoming' ? false : filter === 'all'
  const d = daysUntil(task.due_date)
  switch (filter) {
    case 'overdue': return d < 0
    case 'today': return d === 0
    case 'week': return d >= 0 && d <= 7
    case 'upcoming': return d > 0
    default: return true
  }
}

export function filterTasks(tasks, filter) {
  return tasks.filter((t) => matchesFilter(t, filter))
}

export function taskCounts(tasks) {
  return {
    all: tasks.filter((t) => t.status !== 'done').length,
    overdue: tasks.filter((t) => matchesFilter(t, 'overdue')).length,
    today: tasks.filter((t) => matchesFilter(t, 'today')).length,
    week: tasks.filter((t) => matchesFilter(t, 'week')).length,
    done: tasks.filter((t) => t.status === 'done').length,
  }
}
