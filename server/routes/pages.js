import { Router } from 'express'
import { db } from '../db/index.js'
import { newId, now, buildUpdate, mapRows, decodeBooleans } from '../lib/helpers.js'
import { httpError } from '../lib/http.js'

const router = Router()
const ALLOWED = ['title', 'body', 'icon', 'color', 'parent_id', 'sort_order', 'is_focus', 'archived']
const BOOLS = ['is_focus', 'archived']

// GET /api/pages — flat list of all non-archived pages; the client builds the tree.
router.get('/', async (req, res) => {
  const rows = await db.prepare('SELECT * FROM pages WHERE archived = 0 ORDER BY sort_order, created_at').all()
  res.json(mapRows(rows, BOOLS))
})

// GET /api/pages/:id — a page plus its ancestor breadcrumb trail (root → page).
router.get('/:id', async (req, res) => {
  const page = await db.prepare('SELECT * FROM pages WHERE id = ?').get(req.params.id)
  if (!page) return res.status(404).json(httpError('Page not found', 'NOT_FOUND'))
  const trail = []
  let cursor = page
  const guard = new Set()
  while (cursor?.parent_id && !guard.has(cursor.parent_id)) {
    guard.add(cursor.parent_id)
    const parent = await db.prepare('SELECT id, title, icon FROM pages WHERE id = ?').get(cursor.parent_id)
    if (!parent) break
    trail.unshift(parent)
    cursor = parent
  }
  res.json({ ...decodeBooleans(page, BOOLS), breadcrumb: trail })
})

router.post('/', async (req, res) => {
  const ts = now()
  const id = newId()
  const parent_id = req.body.parent_id || null
  // IS NOT DISTINCT FROM handles NULL parent_id (top-level pages); plain IS @p is invalid in Postgres.
  const max = (await db.prepare('SELECT COALESCE(MAX(sort_order), -1) m FROM pages WHERE parent_id IS NOT DISTINCT FROM @p')
    .get({ p: parent_id })).m
  await db.prepare(`INSERT INTO pages (id,parent_id,title,icon,color,body,is_focus,sort_order,archived,created_at,updated_at)
    VALUES (@id,@parent_id,@title,@icon,@color,'',0,@sort,0,@ts,@ts)`).run({
    id, parent_id,
    title: req.body.title?.trim() || 'Untitled',
    icon: req.body.icon || '📄',
    color: req.body.color || null,
    sort: max + 1, ts,
  })
  res.status(201).json(decodeBooleans(await db.prepare('SELECT * FROM pages WHERE id = ?').get(id), BOOLS))
})

router.patch('/:id', async (req, res) => {
  const existing = await db.prepare('SELECT id FROM pages WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json(httpError('Page not found', 'NOT_FOUND'))
  const patch = { ...req.body }
  for (const b of BOOLS) if (b in patch) patch[b] = patch[b] ? 1 : 0
  // Prevent making a page its own ancestor (cheap guard).
  if (patch.parent_id === req.params.id) delete patch.parent_id
  const upd = buildUpdate('pages', req.params.id, patch, ALLOWED)
  if (upd) await db.prepare(upd.sql).run(upd.params)
  res.json(decodeBooleans(await db.prepare('SELECT * FROM pages WHERE id = ?').get(req.params.id), BOOLS))
})

// Deleting a page cascades to its subpages (FK ON DELETE CASCADE).
router.delete('/:id', async (req, res) => {
  await db.prepare('DELETE FROM pages WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
