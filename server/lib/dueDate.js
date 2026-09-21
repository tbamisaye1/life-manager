/**
 * Due dates are stored as TEXT: YYYY-MM-DD (all-day / end-of-day) or a local
 * datetime with a T (e.g. YYYY-MM-DDTHH:mm). Date-only values sort as end of
 * day (11:00 PM) so a Monday morning class (09:25) ranks above "due Monday".
 */

/** Default clock time when a task is due "that day" with no explicit time. */
export const END_OF_DAY_TIME = '23:00'
export const END_OF_DAY_SORT = '23:00:00'

/** SQL expression: nulls last-friendly sort key for a bare `due_date` column. */
export const DUE_SORT_KEY = `(CASE
  WHEN due_date IS NULL THEN NULL
  WHEN due_date NOT LIKE '%T%' THEN due_date || 'T${END_OF_DAY_SORT}'
  ELSE due_date
END)`

/** Same, when the tasks table is aliased as `t`. */
export const DUE_SORT_KEY_T = `(CASE
  WHEN t.due_date IS NULL THEN NULL
  WHEN t.due_date NOT LIKE '%T%' THEN t.due_date || 'T${END_OF_DAY_SORT}'
  ELSE t.due_date
END)`

/** JS sort key for client-side ordering. */
export function dueSortKey(due) {
  if (!due) return '\uffff'
  if (!String(due).includes('T')) return `${String(due).slice(0, 10)}T${END_OF_DAY_SORT}`
  return String(due)
}

/**
 * Persist due dates with an explicit time. Bare YYYY-MM-DD → that day at 11:00 PM.
 */
export function normalizeDueDate(due) {
  if (due == null) return null
  const s = String(due).trim()
  if (!s) return null
  if (!s.includes('T')) return `${s.slice(0, 10)}T${END_OF_DAY_TIME}`
  return s.length >= 16 ? s.slice(0, 16) : s
}
