import { localDateStr } from './helpers.js'

/**
 * Whether a recurring item (priority) is "done for its current period":
 * a daily item counts if last done on the local calendar day; a weekly item if
 * done within the last 7 days. Shared by the priorities route and the dashboard
 * so the two never drift.
 */
export function isDoneForPeriod(row) {
  if (!row.last_done_at) return false
  const last = new Date(row.last_done_at)
  if (row.cadence === 'weekly') {
    return (Date.now() - last.getTime()) / 864e5 < 7
  }
  return localDateStr(last) === localDateStr()
}
