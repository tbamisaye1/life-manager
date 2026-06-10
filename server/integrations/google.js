// Google integration (Calendar + Gmail) — MULTI-ACCOUNT.
// Each connected Google account stores its own OAuth tokens in google_accounts;
// its calendars are discovered into google_calendars; selected calendars are
// mirrored into the shared `events` table (source='google') so they show up in
// the daily schedule + month calendar on both web and mobile. Degrades
// gracefully: with no credentials/accounts, everything returns empty.
import { google } from 'googleapis'
import { db } from '../db/index.js'
import { newId, now } from '../lib/helpers.js'

// Full calendar scope so we can list every calendar and (later) write to them.
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
]

const PALETTE = ['blue', 'violet', 'emerald', 'amber', 'rose', 'orange', 'teal', 'red', 'slate']
function paletteFor(key) {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

export function isConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

// ─── Home timezone (display everything in the user's current location) ──────────
async function getSetting(key, fallback) {
  const row = await db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key)
  return row?.value ?? fallback
}
export async function homeTimezone() {
  return getSetting('home_timezone', 'Europe/London')
}
export async function setHomeTimezone(tz) {
  await db.prepare("INSERT INTO app_settings (key,value) VALUES ('home_timezone',@v) ON CONFLICT(key) DO UPDATE SET value=@v").run({ v: tz })
}

// Convert an absolute instant (ISO with offset or Z) to a NAIVE wall-clock
// string in `tz`, so every calendar is normalised to the user's timezone.
function instantToNaive(iso, tz) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(d).map((p) => [p.type, p.value]),
  )
  const hour = parts.hour === '24' ? '00' : parts.hour
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}:${parts.second}`
}

function oauthClient(redirectUri) {
  return new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, redirectUri)
}

// ─── Accounts ──────────────────────────────────────────────────────────────────

export async function listAccounts() {
  const rows = await db.prepare('SELECT email, label, is_default, connected_at, last_synced_at FROM google_accounts ORDER BY connected_at').all()
  return rows.map((r) => ({ email: r.email, label: r.label, is_default: !!r.is_default, connected_at: r.connected_at, last_synced_at: r.last_synced_at }))
}

export async function status() {
  const accounts = await listAccounts()
  return { provider: 'google', configured: isConfigured(), connected: accounts.length > 0, accounts }
}

export function getAuthUrl(redirectUri) {
  if (!isConfigured()) return null
  return oauthClient(redirectUri).generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent select_account', // lets the user pick WHICH account, and forces a refresh_token
    scope: SCOPES,
    include_granted_scopes: true,
  })
}

export async function handleCallback(code, redirectUri) {
  const client = oauthClient(redirectUri)
  const { tokens } = await client.getToken(code)
  client.setCredentials(tokens)

  let email = null
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: client })
    email = (await oauth2.userinfo.get()).data.email
  } catch { /* ignore */ }
  if (!email) throw new Error('Could not read the Google account email.')

  const existing = await db.prepare('SELECT email FROM google_accounts WHERE email = ?').get(email)
  const anyDefault = await db.prepare('SELECT email FROM google_accounts WHERE is_default = 1').get()
  const ts = now()
  await db.prepare(`INSERT INTO google_accounts (email,label,access_token,refresh_token,expiry,scope,is_default,connected_at,last_synced_at)
    VALUES (@email,@label,@access,@refresh,@expiry,@scope,@isDefault,@ts,NULL)
    ON CONFLICT(email) DO UPDATE SET access_token=@access, refresh_token=COALESCE(@refresh, google_accounts.refresh_token), expiry=@expiry, scope=@scope, connected_at=@ts`).run({
    email,
    label: email,
    access: tokens.access_token,
    refresh: tokens.refresh_token || null,
    expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
    scope: tokens.scope || SCOPES.join(' '),
    isDefault: !existing && !anyDefault ? 1 : 0,
    ts,
  })
  await refreshCalendars(email).catch(() => {})
  return { email }
}

export async function setDefaultAccount(email) {
  await db.prepare('UPDATE google_accounts SET is_default = 0').run()
  await db.prepare('UPDATE google_accounts SET is_default = 1 WHERE email = ?').run(email)
}

export async function setLabel(email, label) {
  await db.prepare('UPDATE google_accounts SET label = ? WHERE email = ?').run(label, email)
}

export async function disconnect(email) {
  await db.prepare('DELETE FROM google_accounts WHERE email = ?').run(email) // cascades google_calendars
  await db.prepare("DELETE FROM events WHERE source = 'google' AND google_account = ?").run(email)
  const def = await db.prepare('SELECT email FROM google_accounts WHERE is_default = 1').get()
  if (!def) {
    const any = await db.prepare('SELECT email FROM google_accounts ORDER BY connected_at LIMIT 1').get()
    if (any) await db.prepare('UPDATE google_accounts SET is_default = 1 WHERE email = ?').run(any.email)
  }
}

async function authedClientFor(email) {
  const a = await db.prepare('SELECT * FROM google_accounts WHERE email = ?').get(email)
  if (!a || (!a.access_token && !a.refresh_token)) return null
  const client = oauthClient()
  client.setCredentials({
    access_token: a.access_token,
    refresh_token: a.refresh_token,
    expiry_date: a.expiry ? new Date(a.expiry).getTime() : undefined,
    scope: a.scope,
  })
  // Persist tokens the library refreshes for us.
  client.on('tokens', (t) => {
    db.prepare('UPDATE google_accounts SET access_token = COALESCE(?, access_token), refresh_token = COALESCE(?, refresh_token), expiry = ? WHERE email = ?')
      .run(t.access_token || null, t.refresh_token || null, t.expiry_date ? new Date(t.expiry_date).toISOString() : a.expiry, email)
      .catch(() => {})
  })
  return client
}

// ─── Calendars ──────────────────────────────────────────────────────────────────

export async function refreshCalendars(email) {
  const auth = await authedClientFor(email)
  if (!auth) return
  const cal = google.calendar({ version: 'v3', auth })
  const res = await cal.calendarList.list({ maxResults: 250 })
  const ts = now()
  for (const c of res.data.items || []) {
    const id = `${email}::${c.id}`
    const existing = await db.prepare('SELECT id FROM google_calendars WHERE id = ?').get(id)
    const summary = c.summaryOverride || c.summary || c.id
    if (existing) {
      await db.prepare('UPDATE google_calendars SET summary=?, is_primary=?, access_role=?, timezone=?, updated_at=? WHERE id=?')
        .run(summary, c.primary ? 1 : 0, c.accessRole || null, c.timeZone || null, ts, id)
    } else {
      await db.prepare(`INSERT INTO google_calendars (id,account_email,calendar_id,summary,color,is_primary,access_role,timezone,selected,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,1,?,?)`)
        .run(id, email, c.id, summary, paletteFor(c.id), c.primary ? 1 : 0, c.accessRole || null, c.timeZone || null, ts, ts)
    }
  }
}

export async function listCalendars() {
  const rows = await db.prepare('SELECT * FROM google_calendars ORDER BY account_email, is_primary DESC, summary').all()
  return rows.map((c) => ({ ...c, is_primary: !!c.is_primary, selected: !!c.selected }))
}

export async function setCalendarSelected(id, selected) {
  await db.prepare('UPDATE google_calendars SET selected = ?, updated_at = ? WHERE id = ?').run(selected ? 1 : 0, now(), id)
  if (!selected) {
    const row = await db.prepare('SELECT account_email, calendar_id FROM google_calendars WHERE id = ?').get(id)
    if (row) await db.prepare("DELETE FROM events WHERE source='google' AND google_account=? AND google_calendar_id=?").run(row.account_email, row.calendar_id)
  }
}

// ─── Sync (read Google → local events) ────────────────────────────────────────

async function syncAccountCalendars(email) {
  const auth = await authedClientFor(email)
  if (!auth) return 0
  const cal = google.calendar({ version: 'v3', auth })
  const calendars = await db.prepare('SELECT calendar_id, color FROM google_calendars WHERE account_email = ? AND selected = 1').all(email)
  const tz = await homeTimezone()
  const timeMin = new Date(Date.now() - 14 * 864e5).toISOString()
  const timeMax = new Date(Date.now() + 120 * 864e5).toISOString()
  let n = 0
  for (const c of calendars) {
    let res
    try {
      res = await cal.events.list({ calendarId: c.calendar_id, timeMin, timeMax, singleEvents: true, orderBy: 'startTime', maxResults: 250 })
    } catch { continue }
    const ts = now()
    for (const e of res.data.items || []) {
      if (e.status === 'cancelled') continue
      const isAllDay = !!e.start?.date && !e.start?.dateTime
      const rawStart = e.start?.dateTime || e.start?.date
      if (!rawStart) continue
      const rawEnd = e.end?.dateTime || e.end?.date || rawStart
      // Normalise timed events to the user's home timezone; keep all-day as a date.
      const start = isAllDay ? rawStart : instantToNaive(rawStart, tz)
      const end = isAllDay ? rawEnd : instantToNaive(rawEnd, tz)
      const allDay = isAllDay ? 1 : 0
      const existing = await db.prepare("SELECT id FROM events WHERE source='google' AND external_id=?").get(e.id)
      if (existing) {
        // flagship=0: Google events live on the daily schedule, not the month overview.
        await db.prepare(`UPDATE events SET title=@title, start=@start, "end"=@end, all_day=@allDay, location=@location, notes=@notes, color=@color, flagship=0, google_account=@email, google_calendar_id=@cal, updated_at=@ts WHERE id=@id`)
          .run({ id: existing.id, title: e.summary || '(no title)', start, end, allDay, location: e.location || '', notes: e.description || '', color: c.color || 'blue', email, cal: c.calendar_id, ts })
      } else {
        await db.prepare(`INSERT INTO events (id,title,start,"end",all_day,location,notes,color,flagship,source,external_id,google_account,google_calendar_id,created_at,updated_at)
          VALUES (@id,@title,@start,@end,@allDay,@location,@notes,@color,0,'google',@ext,@email,@cal,@ts,@ts)`)
          .run({ id: newId(), title: e.summary || '(no title)', start, end, allDay, location: e.location || '', notes: e.description || '', color: c.color || 'blue', ext: e.id, email, cal: c.calendar_id, ts })
      }
      n++
    }
  }
  await db.prepare('UPDATE google_accounts SET last_synced_at = ? WHERE email = ?').run(now(), email)
  return n
}

async function syncGmail(email) {
  const auth = await authedClientFor(email)
  if (!auth) return 0
  const gmail = google.gmail({ version: 'v1', auth })
  const list = await gmail.users.messages.list({ userId: 'me', maxResults: 20, q: 'in:inbox' })
  const ts = now()
  let n = 0
  for (const m of list.data.messages || []) {
    if (await db.prepare("SELECT id FROM emails WHERE source='google' AND external_id=?").get(m.id)) continue
    const msg = await gmail.users.messages.get({ userId: 'me', id: m.id, format: 'metadata', metadataHeaders: ['From', 'Subject', 'Date'] })
    const headers = Object.fromEntries((msg.data.payload?.headers || []).map((h) => [h.name, h.value]))
    const from = headers.From || ''
    await db.prepare(`INSERT INTO emails (id,from_name,from_email,subject,snippet,body,received_at,is_read,pinned,needs_reply,source,external_id,created_at,updated_at)
      VALUES (@id,@fn,@fe,@sub,@snip,@snip,@recv,@read,0,0,'google',@ext,@ts,@ts)`).run({
      id: newId(), fn: from.replace(/<.*>/, '').trim().replace(/"/g, '') || from, fe: from.match(/<(.+)>/)?.[1] || from,
      sub: headers.Subject || '(no subject)', snip: msg.data.snippet || '', recv: headers.Date ? new Date(headers.Date).toISOString() : ts,
      read: (msg.data.labelIds || []).includes('UNREAD') ? 0 : 1, ext: m.id, ts,
    })
    n++
  }
  return n
}

export async function syncAll() {
  const accounts = await db.prepare('SELECT email FROM google_accounts').all()
  if (!accounts.length) return { connected: false, calendar: 0, gmail: 0 }
  let calendar = 0
  for (const { email } of accounts) {
    await refreshCalendars(email).catch(() => {})
    calendar += await syncAccountCalendars(email).catch(() => 0)
  }
  const def = (await db.prepare('SELECT email FROM google_accounts WHERE is_default = 1').get()) || accounts[0]
  const gmail = def ? await syncGmail(def.email).catch(() => 0) : 0
  return { connected: true, calendar, gmail }
}

// ─── Write-back (local → Google) ──────────────────────────────────────────────

export async function defaultTarget() {
  const def = (await db.prepare('SELECT email FROM google_accounts WHERE is_default = 1').get()) ||
    (await db.prepare('SELECT email FROM google_accounts ORDER BY connected_at LIMIT 1').get())
  if (!def) return null
  const cal =
    (await db.prepare('SELECT calendar_id FROM google_calendars WHERE account_email=? AND is_primary=1').get(def.email)) ||
    (await db.prepare('SELECT calendar_id FROM google_calendars WHERE account_email=? LIMIT 1').get(def.email))
  return cal ? { email: def.email, calendarId: cal.calendar_id } : null
}

// Resolve a free-text calendar/account hint ("yale", "rotunda", "yahoo", a
// calendar name) to a {email, calendarId}. No hint → the default account's
// primary. Returns null if there are no connected Google calendars.
export async function resolveCalendarTarget(hint) {
  if (!hint || !hint.trim()) return defaultTarget()
  const f = `%${hint.trim()}%`
  const row = await db.prepare(
    `SELECT account_email, calendar_id FROM google_calendars
     WHERE selected = 1 AND (account_email ILIKE ? OR summary ILIKE ?)
     ORDER BY is_primary DESC LIMIT 1`,
  ).get(f, f)
  return row ? { email: row.account_email, calendarId: row.calendar_id } : null
}

function timeParts(start, end, allDay, tz) {
  if (allDay) return { start: { date: String(start).slice(0, 10) }, end: { date: String(end || start).slice(0, 10) } }
  return {
    start: { dateTime: start, timeZone: tz || undefined },
    end: { dateTime: end || start, timeZone: tz || undefined },
  }
}

async function calColor(email, calendarId) {
  return (await db.prepare('SELECT color FROM google_calendars WHERE account_email=? AND calendar_id=?').get(email, calendarId))?.color || 'blue'
}

// Create on Google AND mirror into local events; returns the local event row.
export async function createEvent({ email, calendarId, title, start, end, allDay, location, notes, flagship }) {
  const auth = await authedClientFor(email)
  if (!auth) throw new Error('That Google account is not connected.')
  const cal = google.calendar({ version: 'v3', auth })
  const tz = await homeTimezone()
  const { start: gStart, end: gEnd } = timeParts(start, end, allDay, tz)
  const res = await cal.events.insert({
    calendarId,
    requestBody: { summary: title, location: location || '', description: notes || '', start: gStart, end: gEnd },
  })
  const g = res.data
  const ts = now()
  const id = newId()
  await db.prepare(`INSERT INTO events (id,title,start,"end",all_day,location,notes,color,flagship,source,external_id,google_account,google_calendar_id,created_at,updated_at)
    VALUES (@id,@title,@start,@end,@allDay,@location,@notes,@color,@flagship,'google',@ext,@email,@cal,@ts,@ts)`).run({
    id, title, start, end: end || start, allDay: allDay ? 1 : 0, location: location || '', notes: notes || '',
    color: await calColor(email, calendarId), flagship: flagship === false ? 0 : 1, ext: g.id, email, cal: calendarId, ts,
  })
  return db.prepare('SELECT * FROM events WHERE id = ?').get(id)
}

// Build a Google RRULE string from a simple recurrence spec.
const RRULE_DOW = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
function buildRRULE({ frequency, weekdays, until, count }) {
  const hasDays = Array.isArray(weekdays) && weekdays.length > 0
  const freq = hasDays ? 'WEEKLY' : frequency === 'daily' ? 'DAILY' : 'WEEKLY'
  const parts = [`FREQ=${freq}`]
  if (hasDays) parts.push(`BYDAY=${weekdays.map((d) => RRULE_DOW[d]).join(',')}`)
  if (count && count > 0) parts.push(`COUNT=${Math.min(count, 730)}`)
  else if (until) parts.push(`UNTIL=${String(until).slice(0, 10).replace(/-/g, '')}T235959Z`)
  return `RRULE:${parts.join(';')}`
}

// Create ONE native recurring event on Google (RRULE) — Google expands the
// occurrences, so there's no per-instance looping. Then sync so the instances
// mirror into the app. Returns { recurringEventId }.
export async function createRecurringEvent({ email, calendarId, title, start, end, allDay, location, notes, frequency, weekdays, until, count }) {
  const auth = await authedClientFor(email)
  if (!auth) throw new Error('That Google account is not connected.')
  const cal = google.calendar({ version: 'v3', auth })
  const tz = await homeTimezone()
  const { start: gStart, end: gEnd } = timeParts(start, end, allDay, tz)
  const res = await cal.events.insert({
    calendarId,
    requestBody: { summary: title, location: location || '', description: notes || '', start: gStart, end: gEnd, recurrence: [buildRRULE({ frequency, weekdays, until, count })] },
  })
  await syncAccountCalendars(email).catch(() => {})
  return { recurringEventId: res.data.id }
}

// Push a local edit of a google-sourced event back to Google. Returns true if pushed.
export async function pushUpdate(event, patch) {
  if (event.source !== 'google' || !event.google_account || !event.external_id) return false
  const auth = await authedClientFor(event.google_account)
  if (!auth) return false
  const cal = google.calendar({ version: 'v3', auth })
  const tz = await homeTimezone()
  const body = {}
  if (patch.title !== undefined) body.summary = patch.title
  if (patch.location !== undefined) body.location = patch.location
  if (patch.notes !== undefined) body.description = patch.notes
  if (patch.start !== undefined || patch.end !== undefined || patch.all_day !== undefined) {
    const allDay = (patch.all_day ?? event.all_day) ? true : false
    const parts = timeParts(patch.start ?? event.start, patch.end ?? event.end, allDay, tz)
    body.start = parts.start
    body.end = parts.end
  }
  await cal.events.patch({ calendarId: event.google_calendar_id, eventId: event.external_id, requestBody: body })
  return true
}

export async function pushDelete(event) {
  if (event.source !== 'google' || !event.google_account || !event.external_id) return false
  const auth = await authedClientFor(event.google_account)
  if (!auth) return false
  const cal = google.calendar({ version: 'v3', auth })
  try {
    await cal.events.delete({ calendarId: event.google_calendar_id, eventId: event.external_id })
  } catch (e) {
    if (e.code !== 404 && e.code !== 410) throw e // already gone is fine
  }
  return true
}
