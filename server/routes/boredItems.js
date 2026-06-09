import { Router } from 'express'
import { db } from '../db/index.js'
import { newId, now, buildUpdate, mapRows, decodeBooleans } from '../lib/helpers.js'
import { httpError } from '../lib/http.js'

const router = Router()
const ALLOWED = ['title', 'emoji', 'category', 'body', 'done', 'sort_order']
const BOOLS = ['done']

// The curated "I'm Bored" list — fully user-editable, no auto-generation.
router.get('/', async (req, res) => {
  const rows = await db.prepare('SELECT * FROM bored_items ORDER BY done, sort_order, created_at').all()
  res.json(mapRows(rows, BOOLS))
})

router.get('/:id', async (req, res) => {
  const row = await db.prepare('SELECT * FROM bored_items WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json(httpError('Not found', 'NOT_FOUND'))
  res.json(decodeBooleans(row, BOOLS))
})

router.post('/', async (req, res) => {
  const { title } = req.body
  if (!title?.trim()) return res.status(400).json(httpError('Title is required', 'VALIDATION'))
  const ts = now(); const id = newId()
  const max = (await db.prepare('SELECT COALESCE(MAX(sort_order), -1) m FROM bored_items').get()).m
  await db.prepare(`INSERT INTO bored_items (id,title,emoji,category,body,done,sort_order,created_at,updated_at)
    VALUES (@id,@title,@emoji,@category,'',0,@sort,@ts,@ts)`).run({
    id, title: title.trim(), emoji: req.body.emoji || '💡', category: req.body.category || 'other', sort: max + 1, ts,
  })
  res.status(201).json(decodeBooleans(await db.prepare('SELECT * FROM bored_items WHERE id = ?').get(id), BOOLS))
})

router.patch('/:id', async (req, res) => {
  const patch = { ...req.body }
  if ('done' in patch) patch.done = patch.done ? 1 : 0
  const upd = buildUpdate('bored_items', req.params.id, patch, ALLOWED)
  if (upd) await db.prepare(upd.sql).run(upd.params)
  res.json(decodeBooleans(await db.prepare('SELECT * FROM bored_items WHERE id = ?').get(req.params.id), BOOLS))
})

router.delete('/:id', async (req, res) => {
  await db.prepare('DELETE FROM bored_items WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
