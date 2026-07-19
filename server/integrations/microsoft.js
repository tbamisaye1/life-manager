// Microsoft Graph calendar integration — MULTI-ACCOUNT (Outlook / M365).
// Mirrors google.js: OAuth tokens in microsoft_accounts, calendars in
// microsoft_calendars, selected calendars mirrored into `events`
// (source='microsoft'). Calendar-only — no mail sync.
import { db } from '../db/index.js'
import { newId, now } from '../lib/helpers.js'
import { flagshipFromGoogleEvent } from '../lib/flagship.js'
import { normalizeDateTime, seriesKey } from '../lib/eventSeries.js'
import { homeTimezone, setHomeTimezone } from './google.js'

export { homeTimezone, setHomeTimezone }

const AUTH_BASE = 'https://login.microsoftonline.com/common/oauth2/v2.0'
const GRAPH = 'https://graph.microsoft.com/v1.0'

const SCOPES = [
  'offline_access',
  'openid',
  'profile',
  'email',
  'User.Read',
  'Calendars.ReadWrite',
].join(' ')

const PALETTE = ['blue', 'violet', 'emerald', 'amber', 'rose', 'orange', 'teal', 'red', 'slate']
function paletteFor(key) {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

export function isConfigured() {
  return Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET)
}

function instantToNaive(iso, tz) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(d).map((p) => [p.type, p.value]),
  )
  const hour = parts.hour === '24' ? '00' : parts.hour
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}:${parts.second}`
}

/** Graph dateTime is often naive — treat as UTC if Z/offset missing when parsing for display. */
function graphDateTimeToIso(dateTime, timeZone) {
  if (!dateTime) return null
  const s = String(dateTime)
  if (/Z$|[+-]\d{2}:\d{2}$/.test(s)) return s
  // Prefer interpreting in the event's timezone when we can; fall back to appending Z.
  if (timeZone && timeZone !== 'UTC') {
    // Construct a Date by formatting through the zone is hard without a lib —
    // append offset-less and let Instant path use home TZ normalisation after Date parse.
    // Node parses "YYYY-MM-DDTHH:mm:ss" as local server time; force UTC for consistency.
    return `${s.replace(/\.\d+$/, '')}Z`
  }
  return `${s.replace(/\.\d+$/, '')}Z`
}

// ─── Accounts ──────────────────────────────────────────────────────────────────

export async function listAccounts() {
  const rows = await db.prepare('SELECT email, label, is_default, connected_at, last_synced_at FROM microsoft_accounts ORDER BY connected_at').all()
  return rows.map((r) => ({ email: r.email, label: r.label, is_default: !!r.is_default, connected_at: r.connected_at, last_synced_at: r.last_synced_at }))
}

export async function status() {
  const accounts = await listAccounts()
  return { provider: 'microsoft', configured: isConfigured(), connected: accounts.length > 0, accounts }
}

export function getAuthUrl(redirectUri) {
  if (!isConfigured()) return null
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: SCOPES,
    prompt: 'select_account',
  })
  return `${AUTH_BASE}/authorize?${params}`
}

async function exchangeCode(code, redirectUri) {
  const body = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID,
    client_secret: process.env.MICROSOFT_CLIENT_SECRET,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    scope: SCOPES,
  })
  const res = await fetch(`${AUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || data.error || 'Token exchange failed')
  return data
}

async function refreshTokens(refreshToken) {
  const body = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID,
    client_secret: process.env.MICROSOFT_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: SCOPES,
  })
  const res = await fetch(`${AUTH_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || data.error || 'Token refresh failed')
  return data
}

export async function handleCallback(code, redirectUri) {
  const tokens = await exchangeCode(code, redirectUri)
  const me = await graphFetch(tokens.access_token, '/me?$select=mail,userPrincipalName,displayName')
  const email = (me.mail || me.userPrincipalName || '').toLowerCase()
  if (!email) throw new Error('Could not read the Microsoft account email.')

  const existing = await db.prepare('SELECT email FROM microsoft_accounts WHERE email = ?').get(email)
  const anyDefault = await db.prepare('SELECT email FROM microsoft_accounts WHERE is_default = 1').get()
  const ts = now()
  const expiry = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null

  await db.prepare(`INSERT INTO microsoft_accounts (email,label,access_token,refresh_token,expiry,scope,is_default,connected_at,last_synced_at)
    VALUES (@email,@label,@access,@refresh,@expiry,@scope,@isDefault,@ts,NULL)
    ON CONFLICT(email) DO UPDATE SET access_token=@access, refresh_token=COALESCE(@refresh, microsoft_accounts.refresh_token), expiry=@expiry, scope=@scope, connected_at=@ts`).run({
    email,
    label: me.displayName || email,
    access: tokens.access_token,
    refresh: tokens.refresh_token || null,
    expiry,
    scope: tokens.scope || SCOPES,
    isDefault: !existing && !anyDefault ? 1 : 0,
    ts,
  })
  await refreshCalendars(email).catch(() => {})
  return { email }
}

export async function setDefaultAccount(email) {
  await db.prepare('UPDATE microsoft_accounts SET is_default = 0').run()
  await db.prepare('UPDATE microsoft_accounts SET is_default = 1 WHERE email = ?').run(email)
}

export async function setLabel(email, label) {
  await db.prepare('UPDATE microsoft_accounts SET label = ? WHERE email = ?').run(label, email)
}

export async function disconnect(email) {
  await db.prepare('DELETE FROM microsoft_accounts WHERE email = ?').run(email)
  await db.prepare("DELETE FROM events WHERE source = 'microsoft' AND microsoft_account = ?").run(email)
  const def = await db.prepare('SELECT email FROM microsoft_accounts WHERE is_default = 1').get()
  if (!def) {
    const any = await db.prepare('SELECT email FROM microsoft_accounts ORDER BY connected_at LIMIT 1').get()
    if (any) await db.prepare('UPDATE microsoft_accounts SET is_default = 1 WHERE email = ?').run(any.email)
  }
}

async function accessTokenFor(email) {
  const a = await db.prepare('SELECT * FROM microsoft_accounts WHERE email = ?').get(email)
  if (!a || (!a.access_token && !a.refresh_token)) return null

  const expired = a.expiry && new Date(a.expiry).getTime() < Date.now() + 60_000
  if (!expired && a.access_token) return a.access_token
  if (!a.refresh_token) return a.access_token || null

  const tokens = await refreshTokens(a.refresh_token)
  const expiry = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : a.expiry
  await db.prepare('UPDATE microsoft_accounts SET access_token = ?, refresh_token = COALESCE(?, refresh_token), expiry = ? WHERE email = ?')
    .run(tokens.access_token, tokens.refresh_token || null, expiry, email)
  return tokens.access_token
}

async function graphFetch(accessToken, path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(path.startsWith('http') ? path : `${GRAPH}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return null
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data.error?.message || data.error_description || `Graph ${res.status}`
    const err = new Error(msg)
    err.code = res.status
    throw err
  }
  return data
}

async function graphFor(email, path, opts) {
  const token = await accessTokenFor(email)
  if (!token) throw new Error('That Microsoft account is not connected.')
  return graphFetch(token, path, opts)
}

// ─── Calendars ──────────────────────────────────────────────────────────────────

export async function refreshCalendars(email) {
  const data = await graphFor(email, '/me/calendars?$top=100&$select=id,name,isDefaultCalendar,canEdit,owner')
  const ts = now()
  for (const c of data.value || []) {
    const id = `${email}::${c.id}`
    const existing = await db.prepare('SELECT id FROM microsoft_calendars WHERE id = ?').get(id)
    const summary = c.name || c.id
    const accessRole = c.canEdit ? 'writer' : 'reader'
    if (existing) {
      await db.prepare('UPDATE microsoft_calendars SET summary=?, is_primary=?, access_role=?, updated_at=? WHERE id=?')
        .run(summary, c.isDefaultCalendar ? 1 : 0, accessRole, ts, id)
    } else {
      await db.prepare(`INSERT INTO microsoft_calendars (id,account_email,calendar_id,summary,color,is_primary,access_role,timezone,selected,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,1,?,?)`)
        .run(id, email, c.id, summary, paletteFor(c.id), c.isDefaultCalendar ? 1 : 0, accessRole, null, ts, ts)
    }
  }
}

export async function listCalendars() {
  const rows = await db.prepare('SELECT * FROM microsoft_calendars ORDER BY account_email, is_primary DESC, summary').all()
  return rows.map((c) => ({ ...c, is_primary: !!c.is_primary, selected: !!c.selected }))
}

export async function setCalendarSelected(id, selected) {
  await db.prepare('UPDATE microsoft_calendars SET selected = ?, updated_at = ? WHERE id = ?').run(selected ? 1 : 0, now(), id)
  if (!selected) {
    const row = await db.prepare('SELECT account_email, calendar_id FROM microsoft_calendars WHERE id = ?').get(id)
    if (row) {
      await db.prepare("DELETE FROM events WHERE source='microsoft' AND microsoft_account=? AND microsoft_calendar_id=?")
        .run(row.account_email, row.calendar_id)
    }
  }
}

// ─── Sync ───────────────────────────────────────────────────────────────────────

async function syncAccountCalendars(email) {
  const calendars = await db.prepare('SELECT calendar_id, color FROM microsoft_calendars WHERE account_email = ? AND selected = 1').all(email)
  if (!calendars.length) return 0
  const tz = await homeTimezone()
  const timeMin = new Date(Date.now() - 14 * 864e5).toISOString()
  const timeMax = new Date(Date.now() + 120 * 864e5).toISOString()
  const winStart = instantToNaive(timeMin, tz)
  const winEnd = instantToNaive(timeMax, tz)
  let n = 0

  for (const c of calendars) {
    const seen = []
    let url = `/me/calendars/${encodeURIComponent(c.calendar_id)}/calendarView?startDateTime=${encodeURIComponent(timeMin)}&endDateTime=${encodeURIComponent(timeMax)}&$top=250&$select=id,subject,bodyPreview,body,location,isAllDay,start,end,seriesMasterId,type`
    let incomplete = false
    try {
      while (url) {
        const page = await graphFor(email, url, {
          headers: { Prefer: `outlook.timezone="${tz}"` },
        })
        const ts = now()
        for (const e of page.value || []) {
          const isAllDay = !!e.isAllDay
          const rawStart = e.start?.dateTime
          if (!rawStart) continue
          const rawEnd = e.end?.dateTime || rawStart
          let start
          let end
          if (isAllDay) {
            start = String(rawStart).slice(0, 10)
            end = String(rawEnd).slice(0, 10)
          } else {
            // Prefer header asked Graph to return wall times in home TZ — store naive as-is.
            const s = String(rawStart).replace(/\.\d+$/, '').slice(0, 19)
            const en = String(rawEnd).replace(/\.\d+$/, '').slice(0, 19)
            start = s.includes('T') ? s : instantToNaive(graphDateTimeToIso(rawStart, e.start?.timeZone), tz)
            end = en.includes('T') ? en : instantToNaive(graphDateTimeToIso(rawEnd, e.end?.timeZone), tz)
          }
          const allDay = isAllDay ? 1 : 0
          const seriesId = e.seriesMasterId || null
          const existing = await db.prepare("SELECT id, flagship, flagship_override FROM events WHERE source='microsoft' AND external_id=?").get(e.id)
          let flagship = flagshipFromGoogleEvent(e.subject, existing?.flagship)
          if (existing?.flagship_override) flagship = existing.flagship
          const location = e.location?.displayName || ''
          const notes = e.bodyPreview || (typeof e.body?.content === 'string' ? e.body.content.replace(/<[^>]+>/g, '').slice(0, 2000) : '') || ''
          if (existing) {
            await db.prepare(`UPDATE events SET title=@title, start=@start, "end"=@end, all_day=@allDay, location=@location, notes=@notes, color=@color, flagship=@flagship, microsoft_account=@email, microsoft_calendar_id=@cal, series_id=@seriesId, updated_at=@ts WHERE id=@id`)
              .run({ id: existing.id, title: e.subject || '(no title)', start, end, allDay, location, notes, color: c.color || 'blue', flagship, email, cal: c.calendar_id, seriesId, ts })
          } else {
            await db.prepare(`INSERT INTO events (id,title,start,"end",all_day,location,notes,color,flagship,source,external_id,microsoft_account,microsoft_calendar_id,series_id,created_at,updated_at)
              VALUES (@id,@title,@start,@end,@allDay,@location,@notes,@color,@flagship,'microsoft',@ext,@email,@cal,@seriesId,@ts,@ts)`)
              .run({ id: newId(), title: e.subject || '(no title)', start, end, allDay, location, notes, color: c.color || 'blue', flagship, ext: e.id, email, cal: c.calendar_id, seriesId, ts })
          }
          seen.push(e.id)
          n++
        }
        url = page['@odata.nextLink'] || null
        if (url && seen.length >= 2500) { incomplete = true; break }
      }
    } catch {
      continue
    }
    if (!incomplete) await pruneStaleMicrosoftEvents(email, c.calendar_id, winStart, winEnd, seen)
  }
  await db.prepare('UPDATE microsoft_accounts SET last_synced_at = ? WHERE email = ?').run(now(), email)
  return n
}

async function pruneStaleMicrosoftEvents(email, calendarId, winStart, winEnd, seenIds) {
  const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString()
  const params = { email, cal: calendarId, winStart, winEnd, cutoff }
  let notIn = ''
  if (seenIds.length) {
    const placeholders = seenIds.map((id, i) => { params[`s${i}`] = id; return `@s${i}` })
    notIn = ` AND external_id NOT IN (${placeholders.join(',')})`
  }
  await db.prepare(
    `DELETE FROM events WHERE source='microsoft' AND microsoft_account=@email AND microsoft_calendar_id=@cal
       AND start >= @winStart AND start <= @winEnd AND created_at <= @cutoff${notIn}`,
  ).run(params)
}

export async function syncAll() {
  const accounts = await db.prepare('SELECT email FROM microsoft_accounts').all()
  if (!accounts.length) return { connected: false, calendar: 0 }
  let calendar = 0
  for (const { email } of accounts) {
    await refreshCalendars(email).catch(() => {})
    calendar += await syncAccountCalendars(email).catch(() => 0)
  }
  return { connected: true, calendar }
}

// ─── Write-back ─────────────────────────────────────────────────────────────────

export async function defaultTarget() {
  const def = (await db.prepare('SELECT email FROM microsoft_accounts WHERE is_default = 1').get()) ||
    (await db.prepare('SELECT email FROM microsoft_accounts ORDER BY connected_at LIMIT 1').get())
  if (!def) return null
  const cal =
    (await db.prepare('SELECT calendar_id FROM microsoft_calendars WHERE account_email=? AND is_primary=1').get(def.email)) ||
    (await db.prepare('SELECT calendar_id FROM microsoft_calendars WHERE account_email=? LIMIT 1').get(def.email))
  return cal ? { email: def.email, calendarId: cal.calendar_id } : null
}

export async function resolveCalendarTarget(hint) {
  if (!hint || !hint.trim()) return defaultTarget()
  const f = `%${hint.trim()}%`
  const row = await db.prepare(
    `SELECT account_email, calendar_id FROM microsoft_calendars
     WHERE selected = 1 AND (account_email ILIKE ? OR summary ILIKE ?)
     ORDER BY is_primary DESC LIMIT 1`,
  ).get(f, f)
  return row ? { email: row.account_email, calendarId: row.calendar_id } : null
}

function graphTimeParts(start, end, allDay, tz) {
  if (allDay) {
    const s = String(start).slice(0, 10)
    const e = String(end || start).slice(0, 10)
    return {
      start: { dateTime: `${s}T00:00:00`, timeZone: tz },
      end: { dateTime: `${e}T00:00:00`, timeZone: tz },
      isAllDay: true,
    }
  }
  const s = normalizeDateTime(start).replace(/\.\d+Z?$/, '').slice(0, 19)
  const e = normalizeDateTime(end || start).replace(/\.\d+Z?$/, '').slice(0, 19)
  return {
    start: { dateTime: s, timeZone: tz },
    end: { dateTime: e, timeZone: tz },
    isAllDay: false,
  }
}

function applyTimeToAnchor(anchorIso, timeIso) {
  const anchor = String(anchorIso || '').slice(0, 10)
  const time = normalizeDateTime(timeIso).split('T')[1] || '00:00:00'
  return `${anchor}T${time.slice(0, 8)}`
}

async function calColor(email, calendarId) {
  return (await db.prepare('SELECT color FROM microsoft_calendars WHERE account_email=? AND calendar_id=?').get(email, calendarId))?.color || 'blue'
}

const DOW = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function buildRecurrence({ frequency, weekdays, until, count, start }) {
  const hasDays = Array.isArray(weekdays) && weekdays.length > 0
  const type = hasDays || frequency === 'weekly' ? 'weekly' : frequency === 'daily' ? 'daily' : 'weekly'
  const pattern = { type, interval: 1 }
  if (type === 'weekly') {
    pattern.daysOfWeek = hasDays ? weekdays.map((d) => DOW[d]) : [DOW[new Date(`${String(start).slice(0, 10)}T00:00:00`).getDay()]]
  }
  const range = { startDate: String(start).slice(0, 10) }
  if (count && count > 0) {
    range.type = 'numbered'
    range.numberOfOccurrences = Math.min(count, 730)
  } else if (until) {
    range.type = 'endDate'
    range.endDate = String(until).slice(0, 10)
  } else {
    range.type = 'noEnd'
  }
  return { pattern, range }
}

export async function createEvent({ email, calendarId, title, start, end, allDay, location, notes, flagship }) {
  const tz = await homeTimezone()
  const parts = graphTimeParts(start, end, allDay, tz)
  const body = {
    subject: title,
    body: { contentType: 'text', content: notes || '' },
    location: { displayName: location || '' },
    start: parts.start,
    end: parts.end,
    isAllDay: parts.isAllDay,
  }
  const g = await graphFor(email, `/me/calendars/${encodeURIComponent(calendarId)}/events`, { method: 'POST', body })
  const ts = now()
  const id = newId()
  await db.prepare(`INSERT INTO events (id,title,start,"end",all_day,location,notes,color,flagship,source,external_id,microsoft_account,microsoft_calendar_id,created_at,updated_at)
    VALUES (@id,@title,@start,@end,@allDay,@location,@notes,@color,@flagship,'microsoft',@ext,@email,@cal,@ts,@ts)`).run({
    id, title, start, end: end || start, allDay: allDay ? 1 : 0, location: location || '', notes: notes || '',
    color: await calColor(email, calendarId), flagship: flagship === false ? 0 : 1, ext: g.id, email, cal: calendarId, ts,
  })
  return db.prepare('SELECT * FROM events WHERE id = ?').get(id)
}

export async function createRecurringEvent({ email, calendarId, title, start, end, allDay, location, notes, frequency, weekdays, until, count }) {
  const tz = await homeTimezone()
  const parts = graphTimeParts(start, end, allDay, tz)
  const body = {
    subject: title,
    body: { contentType: 'text', content: notes || '' },
    location: { displayName: location || '' },
    start: parts.start,
    end: parts.end,
    isAllDay: parts.isAllDay,
    recurrence: buildRecurrence({ frequency, weekdays, until, count, start }),
  }
  const g = await graphFor(email, `/me/calendars/${encodeURIComponent(calendarId)}/events`, { method: 'POST', body })
  await syncAccountCalendars(email).catch(() => {})
  return { recurringEventId: g.id }
}

export async function pushUpdate(event, patch) {
  if (event.source !== 'microsoft' || !event.microsoft_account || !event.external_id) return false
  const tz = await homeTimezone()
  const body = {}
  if (patch.title !== undefined) body.subject = patch.title
  if (patch.location !== undefined) body.location = { displayName: patch.location }
  if (patch.notes !== undefined) body.body = { contentType: 'text', content: patch.notes }
  if (patch.start !== undefined || patch.end !== undefined || patch.all_day !== undefined) {
    const allDay = (patch.all_day ?? event.all_day) ? true : false
    const parts = graphTimeParts(patch.start ?? event.start, patch.end ?? event.end, allDay, tz)
    body.start = parts.start
    body.end = parts.end
    body.isAllDay = parts.isAllDay
  }
  await graphFor(event.microsoft_account, `/me/events/${encodeURIComponent(event.external_id)}`, { method: 'PATCH', body })
  return true
}

export async function pushUpdateSeriesMaster(event, patch) {
  const sk = seriesKey(event)
  if (!sk?.masterId || event.source !== 'microsoft') return pushUpdate(event, patch)
  const tz = await homeTimezone()
  const body = {}
  if (patch.title !== undefined) body.subject = patch.title
  if (patch.location !== undefined) body.location = { displayName: patch.location }
  if (patch.notes !== undefined) body.body = { contentType: 'text', content: patch.notes }
  if (patch.start !== undefined || patch.end !== undefined || patch.all_day !== undefined) {
    const allDay = (patch.all_day ?? event.all_day) ? true : false
    if (allDay) {
      const parts = graphTimeParts(patch.start ?? event.start, patch.end ?? event.end, true, tz)
      body.start = parts.start
      body.end = parts.end
      body.isAllDay = true
    } else {
      const master = await graphFor(event.microsoft_account, `/me/events/${encodeURIComponent(sk.masterId)}?$select=start,end`)
      const anchorStart = master.start?.dateTime
      const anchorEnd = master.end?.dateTime
      body.start = { dateTime: applyTimeToAnchor(anchorStart, patch.start ?? event.start), timeZone: tz }
      body.end = { dateTime: applyTimeToAnchor(anchorEnd, patch.end ?? event.end), timeZone: tz }
      body.isAllDay = false
    }
  }
  if (Object.keys(body).length === 0) return false
  await graphFor(event.microsoft_account, `/me/events/${encodeURIComponent(sk.masterId)}`, { method: 'PATCH', body })
  return true
}

export async function pushDelete(event) {
  if (event.source !== 'microsoft' || !event.microsoft_account || !event.external_id) return false
  try {
    await graphFor(event.microsoft_account, `/me/events/${encodeURIComponent(event.external_id)}`, { method: 'DELETE' })
  } catch (e) {
    if (e.code !== 404 && e.code !== 410) throw e
  }
  return true
}

export async function pushDeleteSeriesMaster(event) {
  const sk = seriesKey(event)
  if (!sk?.masterId || event.source !== 'microsoft') return pushDelete(event)
  try {
    await graphFor(event.microsoft_account, `/me/events/${encodeURIComponent(sk.masterId)}`, { method: 'DELETE' })
  } catch (e) {
    if (e.code !== 404 && e.code !== 410) throw e
  }
  return true
}
