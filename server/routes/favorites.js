import { Router } from 'express'
import { db } from '../db/index.js'
import { newId, now } from '../lib/helpers.js'

const router = Router()

// Sidebar favorites (pinned routes).
router.get('/', async (req, res) => {
  res.json(await db.prepare('SELECT * FROM favorites ORDER BY sort_order, created_at').all())
})

router.post('/', async (req, res) => {
  const { label, path } = req.body
  if (!label?.trim() || !path) return res.status(400).json({ error: { message: 'label and path required', code: 'VALIDATION' } })
  const max = (await db.prepare('SELECT COALESCE(MAX(sort_order), -1) m FROM favorites').get()).m
  const id = newId()
  await db.prepare('INSERT INTO favorites (id,label,icon,path,sort_order,created_at) VALUES (?,?,?,?,?,?)')
    .run(id, label.trim(), req.body.icon || 'Star', path, max + 1, now())
  res.status(201).json(await db.prepare('SELECT * FROM favorites WHERE id = ?').get(id))
})

router.delete('/:id', async (req, res) => {
  await db.prepare('DELETE FROM favorites WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// Sidebar recents — upsert on visit, keep last 8.
router.get('/recents', async (req, res) => {
  res.json(await db.prepare('SELECT * FROM recents ORDER BY visited_at DESC LIMIT 8').all())
})

router.post('/recents', async (req, res) => {
  const { path, label } = req.body
  if (!path || !label) return res.status(400).json({ error: { message: 'path and label required', code: 'VALIDATION' } })
  await db.prepare(`INSERT INTO recents (path,label,icon,visited_at) VALUES (@path,@label,@icon,@ts)
    ON CONFLICT(path) DO UPDATE SET label=@label, icon=@icon, visited_at=@ts`)
    .run({ path, label, icon: req.body.icon || 'FileText', ts: now() })
  // Trim to the 8 most recent.
  await db.prepare(`DELETE FROM recents WHERE path NOT IN (SELECT path FROM recents ORDER BY visited_at DESC LIMIT 8)`).run()
  res.json({ ok: true })
})

export default router
