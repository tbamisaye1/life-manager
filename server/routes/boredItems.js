import { Router } from 'express'
import { db } from '../db/index.js'
import { newId, now, buildUpdate, mapRows, decodeBooleans } from '../lib/helpers.js'
import { httpError } from '../lib/http.js'

const router = Router()
const ALLOWED = ['title', 'emoji', 'category', 'body', 'done', 'sort_order']
const BOOLS = ['done']

// The curated "I'm Bored" list — fully user-editable, no auto-generation.
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM bored_items ORDER BY done, sort_order, created_at').all()
  res.json(mapRows(rows, BOOLS))
})

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM bored_items WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json(httpError('Not found', 'NOT_FOUND'))
  res.json(decodeBooleans(row, BOOLS))
})

router.post('/', (req, res) => {
  const { title } = req.body
  if (!title?.trim()) return res.status(400).json(httpError('Title is required', 'VALIDATION'))
  const ts = now(); const id = newId()
  const max = db.prepare('SELECT COALESCE(MAX(sort_order), -1) m FROM bored_items').get().m
  db.prepare(`INSERT INTO bored_items (id,title,emoji,category,body,done,sort_order,created_at,updated_at)
    VALUES (@id,@title,@emoji,@category,'',0,@sort,@ts,@ts)`).run({
    id, title: title.trim(), emoji: req.body.emoji || '💡', category: req.body.category || 'other', sort: max + 1, ts,
  })
  res.status(201).json(decodeBooleans(db.prepare('SELECT * FROM bored_items WHERE id = ?').get(id), BOOLS))
})

router.patch('/:id', (req, res) => {
  const patch = { ...req.body }
  if ('done' in patch) patch.done = patch.done ? 1 : 0
  const upd = buildUpdate('bored_items', req.params.id, patch, ALLOWED)
  if (upd) db.prepare(upd.sql).run(upd.params)
  res.json(decodeBooleans(db.prepare('SELECT * FROM bored_items WHERE id = ?').get(req.params.id), BOOLS))
})

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM bored_items WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
