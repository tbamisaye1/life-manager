/** Shared recurring-event helpers (mirrors server/lib/eventSeries.js). */

export function isRecurringEvent(event) {
  if (!event) return false
  if (event.series_id) return true
  return event.source === 'google' && typeof event.external_id === 'string' && event.external_id.includes('_')
}

export const RECUR_SCOPE_LABELS = {
  one: 'This event only',
  following: 'This and following events',
  all: 'All events',
}
