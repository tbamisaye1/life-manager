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

const GOOGLE_FIELDS = ['title', 'start', 'end', 'all_day', 'location', 'notes']

/** datetime-local values omit seconds; Google Calendar requires them. */
export function normalizeDateTime(value) {
  if (value == null || value === '') return value
  const s = String(value)
  if (s.length <= 10) return s
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return `${s}:00`
  return s
}

function fieldEq(existing, patch, key) {
  if (!(key in patch)) return true
  if (key === 'all_day') return !!existing.all_day === !!(patch.all_day ? 1 : patch.all_day)
  if (key === 'start' || key === 'end') {
    return normalizeDateTime(existing[key]) === normalizeDateTime(patch[key])
  }
  return String(existing[key] ?? '') === String(patch[key] ?? '')
}

/** True when a Google write-back is needed (patch differs from stored row on Google fields). */
export function googleFieldsChanged(existing, patch) {
  return GOOGLE_FIELDS.some((k) => (k in patch) && !fieldEq(existing, patch, k))
}

/** Google patch body — only changed fields, datetimes normalised. */
export function googlePatchFrom(existing, patch) {
  const out = {}
  for (const k of GOOGLE_FIELDS) {
    if (!(k in patch) || fieldEq(existing, patch, k)) continue
    if (k === 'start' || k === 'end') out[k] = normalizeDateTime(patch[k])
    else if (k === 'all_day') out[k] = patch.all_day ? 1 : 0
    else out[k] = patch[k]
  }
  return out
}

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
