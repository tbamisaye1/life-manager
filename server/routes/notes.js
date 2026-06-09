import { Router } from 'express'
import { db } from '../db/index.js'
import { newId, now, buildUpdate, mapRows } from '../lib/helpers.js'

const router = Router()
const ALLOWED = ['title', 'body', 'pinned', 'color']
const BOOLS = ['pinned']

router.get('/', async (req, res) => {
  const rows = await db.prepare('SELECT * FROM notes ORDER BY pinned DESC, updated_at DESC').all()
  res.json(mapRows(rows, BOOLS))
})

router.post('/', async (req, res) => {
  const ts = now(); const id = newId()
  await db.prepare(`INSERT INTO notes (id,title,body,pinned,color,created_at,updated_at)
    VALUES (@id,@title,@body,@pinned,@color,@ts,@ts)`).run({
    id, title: req.body.title || '', body: req.body.body || '',
    pinned: req.body.pinned ? 1 : 0, color: req.body.color || 'default', ts,
  })
  res.status(201).json(mapRows([await db.prepare('SELECT * FROM notes WHERE id = ?').get(id)], BOOLS)[0])
})

router.patch('/:id', async (req, res) => {
  const patch = { ...req.body }
  if ('pinned' in patch) patch.pinned = patch.pinned ? 1 : 0
  const upd = buildUpdate('notes', req.params.id, patch, ALLOWED)
  if (upd) await db.prepare(upd.sql).run(upd.params)
  res.json(mapRows([await db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id)], BOOLS)[0])
})

router.delete('/:id', async (req, res) => {
  await db.prepare('DELETE FROM notes WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
