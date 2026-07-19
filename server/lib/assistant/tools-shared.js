import { db } from '../../db/index.js'
import * as googleI from '../../integrations/google.js'
import * as microsoftI from '../../integrations/microsoft.js'

// Shared helpers for the assistant tools. Everything works in local wall-clock
// time — "3pm" means 3pm to the user.
export const pad = (n) => String(n).padStart(2, '0')
export const minutesToIso = (date, mins) => `${date}T${pad(Math.floor(mins / 60))}:${pad(mins % 60)}:00`
export const minutesIntoDay = (iso) => { const d = new Date(iso); return d.getHours() * 60 + d.getMinutes() }
export const addMinutes = (iso, mins) => {
  const d = new Date(iso)
  d.setMinutes(d.getMinutes() + mins)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`
}

// Parse "HH:mm" to minutes, falling back to a default if malformed.
export const parseClock = (value, fallback) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value || '')
  return m ? Number(m[1]) * 60 + Number(m[2]) : fallback
}

// First open gap of `duration` minutes on a day, between earliest/latest bounds.
export async function firstFreeSlot(date, duration, earliest, latest) {
  const dayEnd = parseClock(latest, 22 * 60)
  let cursor = parseClock(earliest, 8 * 60)
  const events = await db
    .prepare('SELECT start, "end" FROM events WHERE all_day = 0 AND substr(start,1,10) = ? ORDER BY start')
    .all(date)
  const busy = events
    .map((e) => {
      const start = minutesIntoDay(e.start)
      let end = e.end ? minutesIntoDay(e.end) : start + 60
      if (end <= start) end = 24 * 60
      return { start, end }
    })
    .sort((a, b) => a.start - b.start)
  for (const block of busy) {
    if (block.start - cursor >= duration) break
    if (block.end > cursor) cursor = block.end
  }
  if (cursor + duration > dayEnd) return null
  return { start: minutesToIso(date, cursor), end: minutesToIso(date, cursor + duration) }
}

// Search events by title fragment and optional date range / flagship filter.
export async function findEvents({ query, from, to, flagshipOnly, source, limit = 25 } = {}) {
  const where = []
  const params = []
  if (query) { where.push('title ILIKE ?'); params.push(`%${query}%`) }
  if (from) { where.push('substr(start,1,10) >= ?'); params.push(from) }
  if (to) { where.push('substr(start,1,10) <= ?'); params.push(to) }
  if (flagshipOnly) where.push('flagship = 1')
  if (source) { where.push('source = ?'); params.push(source) }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const lim = Math.min(Math.max(1, limit), 50)
  const rows = await db
    .prepare(`SELECT id, title, start, "end", all_day, flagship, source, series_id FROM events ${clause} ORDER BY start LIMIT ${lim}`)
    .all(...params)
  return rows.map((r) => ({ ...r, flagship: !!r.flagship }))
}

// Delete one event locally and on the calendar provider when applicable.
export async function removeEventById(eventId) {
  const ev = await db.prepare('SELECT * FROM events WHERE id = ?').get(eventId)
  if (!ev) return { ok: false, message: 'No event with that id.' }
  if (ev.source === 'google') {
    try { await googleI.pushDelete(ev) } catch { /* keep going — drop local mirror */ }
  }
  if (ev.source === 'microsoft') {
    try { await microsoftI.pushDelete(ev) } catch { /* keep going */ }
  }
  await db.prepare('DELETE FROM events WHERE id = ?').run(eventId)
  return { ok: true, id: eventId, title: ev.title }
}

// Match a project by name/short code; returns its id or null.
export async function resolveProjectId(name) {
  if (!name) return null
  const row = await db
    .prepare('SELECT id FROM projects WHERE name ILIKE ? OR short_code ILIKE ? LIMIT 1')
    .get(`%${name}%`, `%${name}%`)
  return row?.id ?? null
}

// Convert plain text (with optional "# heading" and "- bullet" lines) into a
// TipTap doc, stringified — the format the notes editor stores.
export function textToTiptap(text) {
  const lines = String(text || '').split('\n')
  const content = []
  let bullets = null
  const flush = () => { if (bullets) { content.push({ type: 'bulletList', content: bullets }); bullets = null } }

  for (const raw of lines) {
    const line = raw.trimEnd()
    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    const bullet = /^[-*]\s+(.*)$/.exec(line)
    if (heading) {
      flush()
      content.push({ type: 'heading', attrs: { level: heading[1].length }, content: [{ type: 'text', text: heading[2] }] })
    } else if (bullet) {
      bullets = bullets || []
      bullets.push({ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: bullet[1] }] }] })
    } else if (line === '') {
      flush()
      content.push({ type: 'paragraph' })
    } else {
      flush()
      content.push({ type: 'paragraph', content: [{ type: 'text', text: line }] })
    }
  }
  flush()
  return JSON.stringify({ type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] })
}
