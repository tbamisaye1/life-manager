/** Whether an event belongs to a repeating series (local rows or Google instances). */
export function isRecurringEvent(event) {
  if (!event) return false
  if (event.series_id) return true
  return event.source === 'google' && typeof event.external_id === 'string' && event.external_id.includes('_')
}

/** Series identifier for batch updates. */
export function seriesKey(event) {
  if (event.series_id) return { type: 'local', key: event.series_id }
  if (event.source === 'google' && event.external_id?.includes('_')) {
    const masterId = event.external_id.split('_')[0]
    return { type: 'google', key: masterId, masterId }
  }
  return null
}

export const RECUR_SCOPES = ['one', 'following', 'all']

/** Fields stored only in Life Manager — safe to batch without Google write-back. */
export const LOCAL_ONLY_FIELDS = new Set(['flagship', 'color', 'project_id'])

export function googleTimingFields(patch) {
  return ['title', 'start', 'end', 'all_day', 'location', 'notes'].some((k) => k in patch)
}

/** IDs of rows to update/delete for a recurring scope. */
export async function idsForScope(db, event, scope) {
  if (scope === 'one' || !isRecurringEvent(event)) return [event.id]

  const sk = seriesKey(event)
  if (!sk) return [event.id]

  if (sk.type === 'local') {
    if (scope === 'all') {
      return (await db.prepare('SELECT id FROM events WHERE series_id = ? ORDER BY start').all(sk.key)).map((r) => r.id)
    }
    return (await db.prepare('SELECT id FROM events WHERE series_id = ? AND start >= ? ORDER BY start').all(sk.key, event.start)).map((r) => r.id)
  }

  // Google recurring instances mirrored locally.
  const params = {
    email: event.google_account,
    cal: event.google_calendar_id,
    master: sk.masterId,
    like: `${sk.masterId}_%`,
    start: event.start,
  }
  if (scope === 'all') {
    return (await db.prepare(
      `SELECT id FROM events WHERE source='google' AND google_account=@email AND google_calendar_id=@cal
         AND (external_id=@master OR external_id LIKE @like) ORDER BY start`,
    ).all(params)).map((r) => r.id)
  }
  return (await db.prepare(
    `SELECT id FROM events WHERE source='google' AND google_account=@email AND google_calendar_id=@cal
       AND (external_id=@master OR external_id LIKE @like) AND start >= @start ORDER BY start`,
  ).all(params)).map((r) => r.id)
}
