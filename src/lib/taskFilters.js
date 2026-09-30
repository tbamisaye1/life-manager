import { differenceInCalendarDays, parseISO } from 'date-fns'
import { dueSortKey } from './format'

// Pure helpers for bucketing tasks by deadline (+ homework / exams). Kept separate from
// UI so Today, Tasks, Exams, Projects, and mobile can share the same rules.
const daysUntil = (due) => differenceInCalendarDays(parseISO(due), new Date())

export const CUSTOM_DAYS_MIN = 1
export const CUSTOM_DAYS_MAX = 30
export const NEXT_SCOPES = ['all', 'tasks', 'homework', 'exam']

function isHomework(task) {
  return Number(task.is_homework) === 1 || task.is_homework === true
}

function isExam(task) {
  return Number(task.is_exam) === 1 || task.is_exam === true
}

/** Top-level tasks only (subtasks nest under a parent and stay out of list filters). */
export function isTopLevel(task) {
  return !task?.parent_id
}

/** Children of a parent, sorted by sort_order then created_at. */
export function subtasksOf(tasks, parentId) {
  return (tasks || [])
    .filter((t) => t.parent_id === parentId)
    .slice()
    .sort((a, b) => {
      const ao = Number(a.sort_order) || 0
      const bo = Number(b.sort_order) || 0
      if (ao !== bo) return ao - bo
      return String(a.created_at || '').localeCompare(String(b.created_at || ''))
    })
}

export function subtaskProgress(task, allTasks) {
  const kids = allTasks ? subtasksOf(allTasks, task.id) : null
  const total = kids ? kids.length : Number(task.subtask_total) || 0
  const done = kids
    ? kids.filter((t) => t.status === 'done').length
    : Number(task.subtask_done) || 0
  return { total, done }
}

/** Parse `next_3` / `tasks_next_3` / `homework_next_3` / `exam_next_3` (and legacy hw_ aliases). */
export function parseNextFilter(filter) {
  const m = String(filter || '').match(/^(?:(homework|hw|tasks|exam|exams)_)?next_(\d+)$/)
  if (!m) return null
  const days = Number(m[2])
  if (!Number.isFinite(days) || days < CUSTOM_DAYS_MIN || days > CUSTOM_DAYS_MAX) return null
  const prefix = m[1]
  let scope = 'all'
  if (prefix === 'homework' || prefix === 'hw') scope = 'homework'
  else if (prefix === 'tasks') scope = 'tasks'
  else if (prefix === 'exam' || prefix === 'exams') scope = 'exam'
  return { days, scope, homework: scope === 'homework', exam: scope === 'exam', key: nextFilterKey(days, scope) }
}

export function nextFilterKey(days, scope = 'all') {
  const n = Math.min(CUSTOM_DAYS_MAX, Math.max(CUSTOM_DAYS_MIN, Number(days) || 1))
  const s = NEXT_SCOPES.includes(scope) ? scope : 'all'
  if (s === 'homework') return `homework_next_${n}`
  if (s === 'tasks') return `tasks_next_${n}`
  if (s === 'exam') return `exam_next_${n}`
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
  if (filter === 'exam' || filter === 'exams') return isExam(task)

  const next = parseNextFilter(filter)
  if (next) {
    if (next.scope === 'homework' && !isHomework(task)) return false
    if (next.scope === 'tasks' && isHomework(task)) return false
    if (next.scope === 'exam' && !isExam(task)) return false
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

  const examOnly =
    filter === 'exam_tonight' ||
    filter === 'exam_week' ||
    filter === 'exam_upcoming' ||
    filter === 'exam_overdue'
  if (examOnly && !isExam(task)) return false

  if (!task.due_date) {
    if (filter === 'upcoming' || filter === 'exam_upcoming') return false
    if (filter === 'homework') return isHomework(task)
    if (filter === 'exam' || filter === 'exams') return isExam(task)
    return filter === 'all'
  }

  const d = daysUntil(task.due_date)
  switch (filter) {
    case 'overdue':
    case 'exam_overdue':
      return d < 0
    case 'today':
    case 'tonight':
    case 'exam_tonight':
      return d === 0
    case 'week':
    case 'exam_week':
      return d >= 0 && d <= 7
    case 'upcoming':
    case 'exam_upcoming':
      return d >= 0
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
  return tasks
    .filter((t) => isTopLevel(t))
    .filter((t) => matchesFilter(t, filter))
    .slice()
    .sort((a, b) => {
      if (filter === 'done') return 0
      return dueSortKey(a.due_date).localeCompare(dueSortKey(b.due_date))
    })
}

export function countForFilter(tasks, filter) {
  return tasks.filter((t) => isTopLevel(t) && matchesFilter(t, filter)).length
}

export function taskCounts(tasks) {
  const top = tasks.filter((t) => isTopLevel(t))
  return {
    all: top.filter((t) => t.status !== 'done').length,
    overdue: top.filter((t) => matchesFilter(t, 'overdue')).length,
    tonight: top.filter((t) => matchesFilter(t, 'tonight')).length,
    week: top.filter((t) => matchesFilter(t, 'week')).length,
    homework: top.filter((t) => matchesFilter(t, 'homework')).length,
    homework_tonight: top.filter((t) => matchesFilter(t, 'homework_tonight')).length,
    homework_week: top.filter((t) => matchesFilter(t, 'homework_week')).length,
    exam: top.filter((t) => matchesFilter(t, 'exam')).length,
    exam_tonight: top.filter((t) => matchesFilter(t, 'exam_tonight')).length,
    exam_week: top.filter((t) => matchesFilter(t, 'exam_week')).length,
    exam_upcoming: top.filter((t) => matchesFilter(t, 'exam_upcoming')).length,
    exam_overdue: top.filter((t) => matchesFilter(t, 'exam_overdue')).length,
    done: top.filter((t) => t.status === 'done').length,
  }
}

export function examCounts(tasks) {
  const exams = tasks.filter((t) => isTopLevel(t) && isExam(t))
  return {
    exam_upcoming: exams.filter((t) => matchesFilter(t, 'exam_upcoming')).length,
    exam_week: exams.filter((t) => matchesFilter(t, 'exam_week')).length,
    exam_tonight: exams.filter((t) => matchesFilter(t, 'exam_tonight')).length,
    exam_overdue: exams.filter((t) => matchesFilter(t, 'exam_overdue')).length,
    exam: exams.filter((t) => t.status !== 'done').length,
    done: exams.filter((t) => t.status === 'done').length,
  }
}
