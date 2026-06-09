import { Router } from 'express'
import * as googleI from '../integrations/google.js'
import * as notionI from '../integrations/notion.js'
import { asyncRoute, httpError } from '../lib/http.js'

const router = Router()
const FRONTEND = 'http://localhost:5180/settings'

router.get('/status', (req, res) => {
  res.json({ google: googleI.status(), notion: notionI.status() })
})

// --- Google ---
router.get('/google/connect', (req, res) => {
  const url = googleI.getAuthUrl()
  if (!url) return res.status(400).json(httpError('Google is not configured. Add GOOGLE_CLIENT_ID/SECRET to .env', 'NOT_CONFIGURED'))
  res.redirect(url)
})

router.get('/google/callback', asyncRoute(async (req, res) => {
  if (!req.query.code) return res.redirect(`${FRONTEND}?error=google`)
  await googleI.handleCallback(req.query.code)
  await googleI.syncAll().catch(() => {})
  res.redirect(`${FRONTEND}?connected=google`)
}))

router.post('/google/sync', asyncRoute(async (req, res) => {
  res.json(await googleI.syncAll())
}))

router.delete('/google', (req, res) => {
  googleI.disconnect()
  res.json({ ok: true })
})

// --- Notion ---
router.get('/notion/connect', (req, res) => {
  const url = notionI.getAuthUrl()
  if (!url) return res.status(400).json(httpError('Notion OAuth is not configured. Set NOTION_CLIENT_ID/SECRET, or use NOTION_TOKEN.', 'NOT_CONFIGURED'))
  res.redirect(url)
})

router.get('/notion/callback', asyncRoute(async (req, res) => {
  if (!req.query.code) return res.redirect(`${FRONTEND}?error=notion`)
  await notionI.handleCallback(req.query.code)
  res.redirect(`${FRONTEND}?connected=notion`)
}))

router.post('/notion/sync', asyncRoute(async (req, res) => {
  const { databaseId } = req.body
  if (!databaseId) return res.status(400).json(httpError('databaseId is required (from your Notion database URL)', 'VALIDATION'))
  res.json(await notionI.syncTasksFromDatabase(databaseId))
}))

router.delete('/notion', (req, res) => {
  notionI.disconnect()
  res.json({ ok: true })
})

export default router
