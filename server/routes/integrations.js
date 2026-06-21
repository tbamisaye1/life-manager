import { Router } from 'express'
import * as googleI from '../integrations/google.js'
import { normalizeEventEnd } from '../lib/eventTimes.js'
import * as notionI from '../integrations/notion.js'
import { asyncRoute, httpError } from '../lib/http.js'

const router = Router()

// Build absolute URLs from the incoming request so OAuth works on whatever host
// is serving us (localhost in dev, the Vercel domain in prod) — no hardcoding.
function baseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https'
  const host = req.headers['x-forwarded-host'] || req.get('host')
  return `${proto}://${host}`
}
const redirectUriFor = (req) => `${baseUrl(req)}/api/integrations/google/callback`

router.get('/status', asyncRoute(async (req, res) => {
  res.json({ google: await googleI.status(), notion: await notionI.status() })
}))

// --- Google (multi-account) ---
router.get('/google/connect', (req, res) => {
  const url = googleI.getAuthUrl(redirectUriFor(req))
  if (!url) return res.status(400).json(httpError('Google is not configured. Add GOOGLE_CLIENT_ID/SECRET to .env', 'NOT_CONFIGURED'))
  res.redirect(url)
})

router.get('/google/callback', asyncRoute(async (req, res) => {
  const settings = `${baseUrl(req)}/settings`
  if (!req.query.code) return res.redirect(`${settings}?error=google`)
  try {
    await googleI.handleCallback(req.query.code, redirectUriFor(req))
    await googleI.syncAll().catch(() => {})
    res.redirect(`${settings}?connected=google`)
  } catch (err) {
    res.redirect(`${settings}?error=${encodeURIComponent(err.message || 'google')}`)
  }
}))

router.get('/google/accounts', asyncRoute(async (req, res) => {
  res.json(await googleI.listAccounts())
}))

router.get('/google/calendars', asyncRoute(async (req, res) => {
  res.json(await googleI.listCalendars())
}))

router.post('/google/calendars/:id/selected', asyncRoute(async (req, res) => {
  await googleI.setCalendarSelected(req.params.id, req.body.selected !== false)
  res.json({ ok: true })
}))

router.post('/google/accounts/:email/default', asyncRoute(async (req, res) => {
  await googleI.setDefaultAccount(req.params.email)
  res.json({ ok: true })
}))

router.patch('/google/accounts/:email', asyncRoute(async (req, res) => {
  if (req.body.label) await googleI.setLabel(req.params.email, req.body.label)
  res.json({ ok: true })
}))

// Create an event directly on a Google calendar (and mirror it locally).
router.post('/google/events', asyncRoute(async (req, res) => {
  const b = req.body || {}
  if (!b.title?.trim() || !b.start) return res.status(400).json(httpError('title and start are required', 'VALIDATION'))
  const start = b.start
  const end = b.all_day ? (b.end || start) : normalizeEventEnd(start, b.end || start)
  let { email, calendar_id: calendarId } = b
  if (!email || !calendarId) {
    const t = await googleI.defaultTarget()
    if (!t) return res.status(400).json(httpError('No Google calendar connected.', 'NOT_CONNECTED'))
    email = email || t.email
    calendarId = calendarId || t.calendarId
  }
  const recurring = b.frequency || (Array.isArray(b.weekdays) && b.weekdays.length) || b.until || b.count
  if (recurring) {
    const r = await googleI.createRecurringEvent({
      email, calendarId, title: b.title.trim(), start, end, allDay: !!b.all_day,
      location: b.location, notes: b.notes, frequency: b.frequency, weekdays: b.weekdays, until: b.until, count: b.count,
    })
    return res.status(201).json({ ok: true, recurring: true, ...r })
  }
  const event = await googleI.createEvent({
    email, calendarId, title: b.title.trim(), start, end,
    allDay: !!b.all_day, location: b.location, notes: b.notes, flagship: b.flagship,
  })
  res.status(201).json(event)
}))

// Home timezone — everything is displayed normalised to this zone. The mobile
// app posts its device timezone so the schedule tracks the user's location.
router.get('/google/settings', asyncRoute(async (req, res) => {
  res.json({ home_timezone: await googleI.homeTimezone() })
}))

router.post('/google/settings', asyncRoute(async (req, res) => {
  const tz = req.body?.home_timezone
  if (!tz) return res.status(400).json(httpError('home_timezone required', 'VALIDATION'))
  const current = await googleI.homeTimezone()
  if (tz !== current) {
    await googleI.setHomeTimezone(tz)
    await googleI.syncAll().catch(() => {}) // re-normalise all events to the new zone
  }
  res.json({ home_timezone: tz, changed: tz !== current })
}))

router.post('/google/sync', asyncRoute(async (req, res) => {
  res.json(await googleI.syncAll())
}))

router.delete('/google/accounts/:email', asyncRoute(async (req, res) => {
  await googleI.disconnect(req.params.email)
  res.json({ ok: true })
}))

// --- Notion ---
router.get('/notion/connect', (req, res) => {
  const url = notionI.getAuthUrl()
  if (!url) return res.status(400).json(httpError('Notion OAuth is not configured. Set NOTION_CLIENT_ID/SECRET, or use NOTION_TOKEN.', 'NOT_CONFIGURED'))
  res.redirect(url)
})

router.get('/notion/callback', asyncRoute(async (req, res) => {
  const settings = `${baseUrl(req)}/settings`
  if (!req.query.code) return res.redirect(`${settings}?error=notion`)
  await notionI.handleCallback(req.query.code)
  res.redirect(`${settings}?connected=notion`)
}))

router.post('/notion/sync', asyncRoute(async (req, res) => {
  const { databaseId } = req.body
  if (!databaseId) return res.status(400).json(httpError('databaseId is required (from your Notion database URL)', 'VALIDATION'))
  res.json(await notionI.syncTasksFromDatabase(databaseId))
}))

router.delete('/notion', asyncRoute(async (req, res) => {
  await notionI.disconnect()
  res.json({ ok: true })
}))

export default router
