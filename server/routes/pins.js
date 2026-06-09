import { Router } from 'express'
import { db } from '../db/index.js'
import { newId, now, buildUpdate, mapRows, decodeBooleans } from '../lib/helpers.js'
import { httpError } from '../lib/http.js'

const router = Router()
const ALLOWED = ['body', 'color', 'pinned']
const BOOLS = ['pinned']

// Pinboard — frictionless quick-capture notes. Pinned ones float to the top,
// then newest first.
router.get('/', async (req, res) => {
  const rows = await db.prepare('SELECT * FROM pins ORDER BY pinned DESC, created_at DESC').all()
  res.json(mapRows(rows, BOOLS))
})

router.post('/', async (req, res) => {
  const { body } = req.body
  if (!body?.trim()) return res.status(400).json(httpError('Body is required', 'VALIDATION'))
  const ts = now()
  const id = newId()
  await db.prepare(`INSERT INTO pins (id,body,color,pinned,created_at,updated_at)
    VALUES (@id,@body,@color,@pinned,@ts,@ts)`).run({
    id, body: body.trim(), color: req.body.color || 'amber',
    pinned: req.body.pinned ? 1 : 0, ts,
  })
  res.status(201).json(decodeBooleans(await db.prepare('SELECT * FROM pins WHERE id = ?').get(id), BOOLS))
})

router.patch('/:id', async (req, res) => {
  const patch = { ...req.body }
  if ('pinned' in patch) patch.pinned = patch.pinned ? 1 : 0
  if ('body' in patch && typeof patch.body === 'string') patch.body = patch.body.trim()
  const upd = buildUpdate('pins', req.params.id, patch, ALLOWED)
  if (upd) await db.prepare(upd.sql).run(upd.params)
  res.json(decodeBooleans(await db.prepare('SELECT * FROM pins WHERE id = ?').get(req.params.id), BOOLS))
})

router.delete('/:id', async (req, res) => {
  await db.prepare('DELETE FROM pins WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
