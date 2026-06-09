import { Router } from 'express'
import { db } from '../db/index.js'
import { newId, now, buildUpdate } from '../lib/helpers.js'
import { httpError } from '../lib/http.js'
import { touchProject } from '../lib/projects.js'

const router = Router()
const ALLOWED = ['title', 'status', 'emoji', 'due_date', 'priority', 'recurrence', 'project_id', 'notes']

const withProject = `
  SELECT t.*, p.short_code AS project_code, p.color AS project_color, p.emoji AS project_emoji
  FROM tasks t LEFT JOIN projects p ON p.id = t.project_id`

// GET /api/tasks?status=&project_id=&filter=overdue|today|week|upcoming
router.get('/', (req, res) => {
  const rows = db.prepare(`${withProject} ORDER BY (t.due_date IS NULL), t.due_date ASC`).all()
  res.json(rows)
})

router.get('/:id', (req, res) => {
  const row = db.prepare(`${withProject} WHERE t.id = ?`).get(req.params.id)
  if (!row) return res.status(404).json(httpError('Task not found', 'NOT_FOUND'))
  res.json(row)
})

router.post('/', (req, res) => {
  const { title } = req.body
  if (!title?.trim()) return res.status(400).json(httpError('Title is required', 'VALIDATION'))
  const ts = now()
  const id = newId()
  db.prepare(`INSERT INTO tasks (id,title,status,emoji,due_date,priority,recurrence,project_id,notes,source,created_at,updated_at)
    VALUES (@id,@title,@status,@emoji,@due_date,@priority,@recurrence,@project_id,@notes,'local',@ts,@ts)`).run({
    id,
    title: title.trim(),
    status: req.body.status || 'todo',
    emoji: req.body.emoji || '📄',
    due_date: req.body.due_date || null,
    priority: req.body.priority || 'normal',
    recurrence: req.body.recurrence || 'single',
    project_id: req.body.project_id || null,
    notes: req.body.notes || '',
    ts,
  })
  res.status(201).json(db.prepare(`${withProject} WHERE t.id = ?`).get(id))
})

// Advance a due date by the recurrence cadence, preserving date-only vs. timed.
function advanceDue(due, recurrence) {
  const base = due ? new Date(due) : new Date()
  if (recurrence === 'monthly') base.setMonth(base.getMonth() + 1)
  else if (recurrence === 'weekly') base.setDate(base.getDate() + 7)
  else base.setDate(base.getDate() + 1)
  return due && due.length <= 10 ? base.toISOString().slice(0, 10) : base.toISOString()
}

router.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id)
  if (!existing) return res.status(404).json(httpError('Task not found', 'NOT_FOUND'))
  const patch = { ...req.body }
  const isCompleting = patch.status === 'done' && existing.status !== 'done'

  // Completing anything logs work on its project.
  if (isCompleting && existing.project_id) touchProject(existing.project_id)

  if (isCompleting && existing.recurrence && existing.recurrence !== 'single') {
    // Recurring: roll the due date forward and keep it active instead of
    // marking it done forever, so it reappears next period.
    patch.status = 'todo'
    patch.due_date = advanceDue(existing.due_date, existing.recurrence)
    db.prepare('UPDATE tasks SET completed_at = NULL WHERE id = ?').run(req.params.id)
  } else if (isCompleting) {
    db.prepare('UPDATE tasks SET completed_at = ? WHERE id = ?').run(now(), req.params.id)
  } else if (patch.status && patch.status !== 'done') {
    db.prepare('UPDATE tasks SET completed_at = NULL WHERE id = ?').run(req.params.id)
  }

  const upd = buildUpdate('tasks', req.params.id, patch, ALLOWED)
  if (upd) db.prepare(upd.sql).run(upd.params)
  res.json(db.prepare(`${withProject} WHERE t.id = ?`).get(req.params.id))
})

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

export default router
