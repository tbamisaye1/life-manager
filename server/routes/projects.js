import { Router } from 'express'
import { db } from '../db/index.js'
import { newId, now, buildUpdate } from '../lib/helpers.js'
import { httpError } from '../lib/http.js'
import { touchProject } from '../lib/projects.js'

const router = Router()
const ALLOWED = ['name', 'short_code', 'color', 'emoji', 'description', 'archived']

// List projects with activity rollups (open tasks + last worked) for the
// "have I worked on X?" tracker.
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status != 'done') AS open_tasks,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') AS done_tasks
    FROM projects p WHERE p.archived = 0
    ORDER BY p.last_worked_at DESC NULLS LAST`).all()
  res.json(rows)
})

router.get('/:id', (req, res) => {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id)
  if (!project) return res.status(404).json(httpError('Project not found', 'NOT_FOUND'))
  const tasks = db.prepare("SELECT * FROM tasks WHERE project_id = ? ORDER BY (due_date IS NULL), due_date").all(req.params.id)
  const events = db.prepare("SELECT * FROM events WHERE project_id = ? ORDER BY start DESC LIMIT 20").all(req.params.id)
  res.json({ ...project, tasks, events })
})

router.post('/', (req, res) => {
  const { name } = req.body
  if (!name?.trim()) return res.status(400).json(httpError('Name is required', 'VALIDATION'))
  const ts = now()
  const id = newId()
  db.prepare(`INSERT INTO projects (id,name,short_code,color,emoji,description,archived,created_at,updated_at)
    VALUES (@id,@name,@short_code,@color,@emoji,@description,0,@ts,@ts)`).run({
    id, name: name.trim(), short_code: req.body.short_code || null,
    color: req.body.color || 'slate', emoji: req.body.emoji || '📁',
    description: req.body.description || '', ts,
  })
  res.status(201).json(db.prepare('SELECT * FROM projects WHERE id = ?').get(id))
})

router.patch('/:id', (req, res) => {
  const upd = buildUpdate('projects', req.params.id, req.body, ALLOWED)
  if (upd) db.prepare(upd.sql).run(upd.params)
  res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id))
})

// Explicitly log work on a project ("I worked on this just now").
router.post('/:id/touch', (req, res) => {
  touchProject(req.params.id)
  res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id))
})

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
