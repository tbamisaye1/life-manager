import { format, formatDistanceToNow, parseISO, isToday, isYesterday, differenceInDays, differenceInMinutes, differenceInHours } from 'date-fns'

export const PIN_COLORS = ['amber', 'blue', 'emerald', 'rose', 'violet', 'teal', 'orange', 'slate']

export const BUCKET_ORDER = ['today', 'yesterday', 'week', 'older']
export const BUCKET_LABELS = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'This week',
  older: 'Earlier',
}

const URL_RE = /https?:\/\/[^\s]+/g

export function pinAge(iso) {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true })
  } catch {
    return ''
  }
}

/** Compact age for dense tiles — "now", "12m", "3h", "Jun 4". */
export function pinAgeShort(iso) {
  try {
    const d = parseISO(iso)
    const mins = differenceInMinutes(new Date(), d)
    if (mins < 1) return 'now'
    if (mins < 60) return `${mins}m`
    const hrs = differenceInHours(new Date(), d)
    if (hrs < 24) return `${hrs}h`
    const days = differenceInDays(new Date(), d)
    if (days < 7) return `${days}d`
    return format(d, 'MMM d')
  } catch {
    return ''
  }
}

export function pinBucket(iso) {
  try {
    const d = parseISO(iso)
    if (isToday(d)) return 'today'
    if (isYesterday(d)) return 'yesterday'
    if (differenceInDays(new Date(), d) <= 7) return 'week'
    return 'older'
  } catch {
    return 'older'
  }
}

/** Split pins into pinned + time-bucketed unpinned groups for the glance grid. */
export function organizePins(pins) {
  const pinned = pins.filter((p) => p.pinned)
  const buckets = { today: [], yesterday: [], week: [], older: [] }
  for (const p of pins) {
    if (p.pinned) continue
    buckets[pinBucket(p.created_at)].push(p)
  }
  return { pinned, buckets }
}

/** Tiny rotation for sticky-note variety — deterministic from id. */
export function pinTilt(id) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i) * (i + 1)) % 5
  return [-1.2, -0.6, 0, 0.6, 1.2][hash]
}

export function linkParts(body) {
  const parts = []
  let last = 0
  for (const m of body.matchAll(URL_RE)) {
    if (m.index > last) parts.push({ type: 'text', value: body.slice(last, m.index) })
    parts.push({ type: 'url', value: m[0] })
    last = m.index + m[0].length
  }
  if (last < body.length) parts.push({ type: 'text', value: body.slice(last) })
  return parts.length ? parts : [{ type: 'text', value: body }]
}
