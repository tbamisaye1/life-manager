// Google integration (Calendar + Gmail). Real OAuth, but everything degrades
// gracefully: if credentials/tokens are missing, isConfigured()/isConnected()
// return false and the app keeps running on local data. 100% local storage.
import { google } from 'googleapis'
import { db } from '../db/index.js'
import { newId, now } from '../lib/helpers.js'

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
]

export function isConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:4000/api/integrations/google/callback',
  )
}

async function storedAccount() {
  return db.prepare("SELECT * FROM integration_accounts WHERE provider = 'google'").get()
}

export async function isConnected() {
  const a = await storedAccount()
  return Boolean(a && a.access_token)
}

export async function status() {
  const a = await storedAccount()
  return {
    provider: 'google',
    configured: isConfigured(),
    connected: Boolean(a && a.access_token),
    account: a?.account_label || null,
    lastSyncedAt: a?.last_synced_at || null,
  }
}

/** Build the consent URL the user visits to connect their account. */
export function getAuthUrl() {
  if (!isConfigured()) return null
  return oauthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  })
}

/** Exchange the OAuth code for tokens and persist them locally. */
export async function handleCallback(code) {
  const client = oauthClient()
  const { tokens } = await client.getToken(code)
  client.setCredentials(tokens)
  let email = 'google account'
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: client })
    const me = await oauth2.userinfo.get()
    email = me.data.email || email
  } catch { /* non-fatal */ }
  const ts = now()
  await db.prepare(`INSERT INTO integration_accounts (provider,account_label,access_token,refresh_token,expiry,scope,raw,connected_at)
    VALUES ('google',@label,@access,@refresh,@expiry,@scope,@raw,@ts)
    ON CONFLICT(provider) DO UPDATE SET account_label=@label, access_token=@access,
      refresh_token=COALESCE(@refresh, refresh_token), expiry=@expiry, scope=@scope, raw=@raw, connected_at=@ts`).run({
    label: email,
    access: tokens.access_token,
    refresh: tokens.refresh_token || null,
    expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
    scope: (tokens.scope || SCOPES.join(' ')),
    raw: JSON.stringify(tokens),
    ts,
  })
  return { email }
}

export async function disconnect() {
  await db.prepare("DELETE FROM integration_accounts WHERE provider = 'google'").run()
}

async function authedClient() {
  const a = await storedAccount()
  if (!a?.access_token) return null
  const client = oauthClient()
  client.setCredentials({
    access_token: a.access_token,
    refresh_token: a.refresh_token,
    expiry_date: a.expiry ? new Date(a.expiry).getTime() : undefined,
  })
  return client
}

/** Pull upcoming Google Calendar events into the local events table. */
export async function syncCalendar() {
  const auth = await authedClient()
  if (!auth) return { synced: 0 }
  const cal = google.calendar({ version: 'v3', auth })
  const res = await cal.events.list({
    calendarId: 'primary',
    timeMin: new Date(Date.now() - 14 * 864e5).toISOString(),
    timeMax: new Date(Date.now() + 60 * 864e5).toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 250,
  })
  const ts = now()
  const upsert = db.prepare(`INSERT INTO events (id,title,start,"end",all_day,location,notes,color,source,external_id,created_at,updated_at)
    VALUES (@id,@title,@start,@end,@all_day,@location,@notes,'blue','google',@ext,@ts,@ts)
    ON CONFLICT(id) DO NOTHING`)
  let n = 0
  for (const e of res.data.items || []) {
    const exists = await db.prepare("SELECT id FROM events WHERE source='google' AND external_id=?").get(e.id)
    const start = e.start?.dateTime || e.start?.date
    if (!start) continue
    if (exists) {
      await db.prepare(`UPDATE events SET title=@title, start=@start, "end"=@end, all_day=@all_day, location=@location, updated_at=@ts WHERE id=@id`).run({
        id: exists.id, title: e.summary || '(no title)', start, end: e.end?.dateTime || e.end?.date || start,
        all_day: e.start?.date ? 1 : 0, location: e.location || '', ts,
      })
    } else {
      await upsert.run({ id: newId(), title: e.summary || '(no title)', start, end: e.end?.dateTime || e.end?.date || start,
        all_day: e.start?.date ? 1 : 0, location: e.location || '', notes: e.description || '', ext: e.id, ts })
    }
    n++
  }
  await markSynced()
  return { synced: n }
}

/** Pull recent Gmail messages into the local emails table. */
export async function syncGmail() {
  const auth = await authedClient()
  if (!auth) return { synced: 0 }
  const gmail = google.gmail({ version: 'v1', auth })
  const list = await gmail.users.messages.list({ userId: 'me', maxResults: 20, q: 'in:inbox' })
  const ts = now()
  let n = 0
  for (const m of list.data.messages || []) {
    if (await db.prepare("SELECT id FROM emails WHERE source='google' AND external_id=?").get(m.id)) continue
    const msg = await gmail.users.messages.get({ userId: 'me', id: m.id, format: 'metadata', metadataHeaders: ['From', 'Subject', 'Date'] })
    const headers = Object.fromEntries((msg.data.payload?.headers || []).map((h) => [h.name, h.value]))
    const from = headers.From || ''
    const fromName = from.replace(/<.*>/, '').trim().replace(/"/g, '') || from
    const fromEmail = (from.match(/<(.+)>/)?.[1]) || from
    await db.prepare(`INSERT INTO emails (id,from_name,from_email,subject,snippet,body,received_at,is_read,pinned,needs_reply,source,external_id,created_at,updated_at)
      VALUES (@id,@fn,@fe,@sub,@snip,@snip,@recv,@read,0,0,'google',@ext,@ts,@ts)`).run({
      id: newId(), fn: fromName, fe: fromEmail, sub: headers.Subject || '(no subject)',
      snip: msg.data.snippet || '', recv: headers.Date ? new Date(headers.Date).toISOString() : ts,
      read: (msg.data.labelIds || []).includes('UNREAD') ? 0 : 1, ext: m.id, ts,
    })
    n++
  }
  await markSynced()
  return { synced: n }
}

async function markSynced() {
  await db.prepare("UPDATE integration_accounts SET last_synced_at=? WHERE provider='google'").run(now())
}

export async function syncAll() {
  if (!await isConnected()) return { calendar: 0, gmail: 0, connected: false }
  const [calendar, gmail] = await Promise.all([syncCalendar(), syncGmail()])
  return { calendar: calendar.synced, gmail: gmail.synced, connected: true }
}
