/**
 * Yale College recesses where classes do not meet.
 * Source: https://college.yale.edu/academics/academic-calendar
 *
 * Dates are inclusive local calendar days (YYYY-MM-DD).
 * Update this list each academic year.
 */

export const YALE_RECESSES = [
  // Fall 2026
  { start: '2026-10-21', end: '2026-10-25', label: 'October recess' },
  { start: '2026-11-21', end: '2026-11-29', label: 'November recess' },
  // Winter recess begins after finals (Dec 22) — not used for class-day skipping mid-term
  // Spring 2027
  { start: '2027-03-06', end: '2027-03-21', label: 'Spring recess' },
]

/** Single no-class holidays (not multi-day recesses). */
export const YALE_NO_CLASS_DAYS = [
  '2026-09-07', // Labor Day
  '2027-01-18', // MLK Day
]

/**
 * @param {string|null|undefined} due ISO date or datetime
 * @returns {boolean}
 */
export function isYaleNoClassDay(due) {
  if (!due) return false
  const day = String(due).slice(0, 10)
  if (YALE_NO_CLASS_DAYS.includes(day)) return true
  for (const r of YALE_RECESSES) {
    if (day >= r.start && day <= r.end) return true
  }
  return false
}
