import { Router } from 'express'
import { db } from '../db/index.js'
import { newId, now, buildUpdate, mapRows, decodeBooleans, localDateStr } from '../lib/helpers.js'
import { httpError } from '../lib/http.js'
import { suggestForExercise } from '../lib/gym.js'

const router = Router()

// ---------------- Exercise library ----------------
const EX_ALLOWED = ['name', 'category', 'muscle_group', 'unit', 'rep_low', 'rep_high', 'default_sets', 'increment', 'notes', 'archived']

router.get('/exercises', (req, res) => {
  const { category } = req.query
  const rows = category
    ? db.prepare('SELECT * FROM gym_exercises WHERE archived = 0 AND category = ? ORDER BY name').all(category)
    : db.prepare('SELECT * FROM gym_exercises WHERE archived = 0 ORDER BY category, name').all()
  res.json(mapRows(rows, ['archived']))
})

router.post('/exercises', (req, res) => {
  const { name } = req.body
  if (!name?.trim()) return res.status(400).json(httpError('Name is required', 'VALIDATION'))
  const ts = now(); const id = newId()
  db.prepare(`INSERT INTO gym_exercises (id,name,category,muscle_group,unit,rep_low,rep_high,default_sets,increment,notes,archived,created_at,updated_at)
    VALUES (@id,@name,@category,@muscle_group,@unit,@rep_low,@rep_high,@default_sets,@increment,@notes,0,@ts,@ts)`).run({
    id, name: name.trim(), category: req.body.category || 'strength', muscle_group: req.body.muscle_group || null,
    unit: req.body.unit || 'kg', rep_low: req.body.rep_low ?? 8, rep_high: req.body.rep_high ?? 12,
    default_sets: req.body.default_sets ?? 3, increment: req.body.increment ?? 2.5, notes: req.body.notes || '', ts,
  })
  res.status(201).json(db.prepare('SELECT * FROM gym_exercises WHERE id = ?').get(id))
})

router.patch('/exercises/:id', (req, res) => {
  const upd = buildUpdate('gym_exercises', req.params.id, req.body, EX_ALLOWED)
  if (upd) db.prepare(upd.sql).run(upd.params)
  res.json(db.prepare('SELECT * FROM gym_exercises WHERE id = ?').get(req.params.id))
})

router.delete('/exercises/:id', (req, res) => {
  db.prepare('DELETE FROM gym_exercises WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// Progress history for one exercise: top set per session over time + suggestion.
router.get('/exercises/:id/history', (req, res) => {
  const exercise = db.prepare('SELECT * FROM gym_exercises WHERE id = ?').get(req.params.id)
  if (!exercise) return res.status(404).json(httpError('Exercise not found', 'NOT_FOUND'))
  const sessions = db.prepare(`
    SELECT w.id, w.date,
      MAX(s.weight) AS top_weight,
      SUM(s.weight * s.reps) AS volume,
      COUNT(*) AS set_count
    FROM gym_sets s JOIN gym_workouts w ON w.id = s.workout_id
    WHERE s.exercise_id = ?
    GROUP BY w.id ORDER BY w.date`).all(req.params.id)
  res.json({ exercise, sessions, suggestion: suggestForExercise(exercise) })
})

// ---------------- Routines (day templates) ----------------
function routineWithExercises(routine) {
  const exercises = db.prepare(`
    SELECT re.id AS routine_exercise_id, re.target_sets, re.sort_order, e.*
    FROM gym_routine_exercises re JOIN gym_exercises e ON e.id = re.exercise_id
    WHERE re.routine_id = ? ORDER BY re.sort_order`).all(routine.id)
  return { ...routine, exercises }
}

router.get('/routines', (req, res) => {
  const routines = db.prepare('SELECT * FROM gym_routines ORDER BY (weekday IS NULL), weekday, sort_order').all()
  res.json(routines.map(routineWithExercises))
})

router.post('/routines', (req, res) => {
  const { name } = req.body
  if (!name?.trim()) return res.status(400).json(httpError('Name is required', 'VALIDATION'))
  const ts = now(); const id = newId()
  db.prepare(`INSERT INTO gym_routines (id,name,emoji,color,weekday,notes,sort_order,created_at,updated_at)
    VALUES (@id,@name,@emoji,@color,@weekday,@notes,0,@ts,@ts)`).run({
    id, name: name.trim(), emoji: req.body.emoji || '🏋️', color: req.body.color || 'violet',
    weekday: req.body.weekday ?? null, notes: req.body.notes || '', ts,
  })
  res.status(201).json(routineWithExercises(db.prepare('SELECT * FROM gym_routines WHERE id = ?').get(id)))
})

router.patch('/routines/:id', (req, res) => {
  const upd = buildUpdate('gym_routines', req.params.id, req.body, ['name', 'emoji', 'color', 'weekday', 'notes', 'sort_order'])
  if (upd) db.prepare(upd.sql).run(upd.params)
  const routine = db.prepare('SELECT * FROM gym_routines WHERE id = ?').get(req.params.id)
  res.json(routine ? routineWithExercises(routine) : null)
})

router.delete('/routines/:id', (req, res) => {
  db.prepare('DELETE FROM gym_routines WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

router.post('/routines/:id/exercises', (req, res) => {
  const { exercise_id } = req.body
  if (!exercise_id) return res.status(400).json(httpError('exercise_id required', 'VALIDATION'))
  const max = db.prepare('SELECT COALESCE(MAX(sort_order),-1) m FROM gym_routine_exercises WHERE routine_id = ?').get(req.params.id).m
  db.prepare('INSERT INTO gym_routine_exercises (id,routine_id,exercise_id,target_sets,sort_order) VALUES (?,?,?,?,?)')
    .run(newId(), req.params.id, exercise_id, req.body.target_sets ?? 3, max + 1)
  const routine = db.prepare('SELECT * FROM gym_routines WHERE id = ?').get(req.params.id)
  res.status(201).json(routineWithExercises(routine))
})

router.delete('/routines/:id/exercises/:rexId', (req, res) => {
  db.prepare('DELETE FROM gym_routine_exercises WHERE id = ?').run(req.params.rexId)
  const routine = db.prepare('SELECT * FROM gym_routines WHERE id = ?').get(req.params.id)
  res.json(routine ? routineWithExercises(routine) : { ok: true })
})

// ---------------- Schedule + Today ----------------
router.get('/schedule', (req, res) => {
  const routines = db.prepare('SELECT id,name,emoji,color,weekday FROM gym_routines WHERE weekday IS NOT NULL ORDER BY weekday').all()
  const byDay = {}
  for (const r of routines) (byDay[r.weekday] ||= []).push(r)
  res.json({ days: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ weekday: d, routines: byDay[d] || [] })) })
})

router.get('/today', (req, res) => {
  const date = localDateStr()
  const weekday = new Date().getDay()
  const scheduled = db.prepare('SELECT * FROM gym_routines WHERE weekday = ? ORDER BY sort_order').all(weekday)
  const todays = db.prepare('SELECT * FROM gym_workouts WHERE date = ? ORDER BY created_at DESC').all(date)
  res.json({
    date, weekday,
    scheduled: scheduled.map((r) => ({ id: r.id, name: r.name, emoji: r.emoji, color: r.color })),
    workouts: mapRows(todays, ['completed']),
  })
})

// ---------------- Workouts + set logging ----------------
router.get('/workouts', (req, res) => {
  const { date } = req.query
  const rows = date
    ? db.prepare('SELECT * FROM gym_workouts WHERE date = ? ORDER BY created_at DESC').all(date)
    : db.prepare('SELECT * FROM gym_workouts ORDER BY date DESC, created_at DESC LIMIT 30').all()
  res.json(mapRows(rows, ['completed']))
})

// Full logging view: each exercise with last-time numbers + a suggested target
// for THIS session, plus whatever has already been logged.
router.get('/workouts/:id', (req, res) => {
  const workout = db.prepare('SELECT * FROM gym_workouts WHERE id = ?').get(req.params.id)
  if (!workout) return res.status(404).json(httpError('Workout not found', 'NOT_FOUND'))

  // Exercises = routine's exercises + any already logged ad-hoc.
  const planned = workout.routine_id
    ? db.prepare(`SELECT e.*, re.target_sets FROM gym_routine_exercises re JOIN gym_exercises e ON e.id = re.exercise_id
        WHERE re.routine_id = ? ORDER BY re.sort_order`).all(workout.routine_id)
    : []
  const loggedExerciseIds = db.prepare('SELECT DISTINCT exercise_id FROM gym_sets WHERE workout_id = ?').all(req.params.id).map((r) => r.exercise_id)
  const ids = new Set(planned.map((e) => e.id))
  const extras = loggedExerciseIds.filter((id) => !ids.has(id))
    .map((id) => db.prepare('SELECT * FROM gym_exercises WHERE id = ?').get(id)).filter(Boolean)

  const exercises = [...planned, ...extras].map((ex) => {
    const targetSets = ex.target_sets ?? ex.default_sets
    return {
      exercise: { ...ex, target_sets: undefined },
      target_sets: targetSets,
      suggestion: suggestForExercise(ex, workout.id, targetSets),
      sets: db.prepare('SELECT * FROM gym_sets WHERE workout_id = ? AND exercise_id = ? ORDER BY set_number')
        .all(req.params.id, ex.id).map((s) => decodeBooleans(s, ['done'])),
    }
  })

  res.json({ ...decodeBooleans(workout, ['completed']), exercises })
})

router.post('/workouts', (req, res) => {
  const ts = now(); const id = newId()
  const routine = req.body.routine_id ? db.prepare('SELECT name FROM gym_routines WHERE id = ?').get(req.body.routine_id) : null
  db.prepare(`INSERT INTO gym_workouts (id,date,routine_id,title,notes,completed,created_at,updated_at)
    VALUES (@id,@date,@routine_id,@title,'',0,@ts,@ts)`).run({
    id, date: req.body.date || localDateStr(), routine_id: req.body.routine_id || null,
    title: req.body.title || routine?.name || 'Workout', ts,
  })
  res.status(201).json(decodeBooleans(db.prepare('SELECT * FROM gym_workouts WHERE id = ?').get(id), ['completed']))
})

router.patch('/workouts/:id', (req, res) => {
  const patch = { ...req.body }
  if ('completed' in patch) patch.completed = patch.completed ? 1 : 0
  const upd = buildUpdate('gym_workouts', req.params.id, patch, ['title', 'notes', 'completed', 'routine_id'])
  if (upd) db.prepare(upd.sql).run(upd.params)
  res.json(decodeBooleans(db.prepare('SELECT * FROM gym_workouts WHERE id = ?').get(req.params.id), ['completed']))
})

router.delete('/workouts/:id', (req, res) => {
  db.prepare('DELETE FROM gym_workouts WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

router.post('/workouts/:id/sets', (req, res) => {
  const { exercise_id } = req.body
  if (!exercise_id) return res.status(400).json(httpError('exercise_id required', 'VALIDATION'))
  const nextNum = db.prepare('SELECT COALESCE(MAX(set_number),0)+1 n FROM gym_sets WHERE workout_id = ? AND exercise_id = ?')
    .get(req.params.id, exercise_id).n
  const id = newId()
  db.prepare(`INSERT INTO gym_sets (id,workout_id,exercise_id,set_number,weight,reps,rpe,done,created_at)
    VALUES (@id,@wid,@ex,@num,@weight,@reps,@rpe,1,@ts)`).run({
    id, wid: req.params.id, ex: exercise_id, num: req.body.set_number ?? nextNum,
    weight: req.body.weight ?? null, reps: req.body.reps ?? null, rpe: req.body.rpe ?? null, ts: now(),
  })
  res.status(201).json(decodeBooleans(db.prepare('SELECT * FROM gym_sets WHERE id = ?').get(id), ['done']))
})

router.patch('/sets/:setId', (req, res) => {
  const patch = { ...req.body }
  if ('done' in patch) patch.done = patch.done ? 1 : 0
  // gym_sets has no updated_at column, so write the allowed fields directly.
  const fields = ['weight', 'reps', 'rpe', 'done', 'set_number'].filter((f) => f in patch)
  if (fields.length) {
    const sql = `UPDATE gym_sets SET ${fields.map((f) => `${f} = @${f}`).join(', ')} WHERE id = @id`
    db.prepare(sql).run({ ...patch, id: req.params.setId })
  }
  res.json(decodeBooleans(db.prepare('SELECT * FROM gym_sets WHERE id = ?').get(req.params.setId), ['done']))
})

router.delete('/sets/:setId', (req, res) => {
  db.prepare('DELETE FROM gym_sets WHERE id = ?').run(req.params.setId)
  res.json({ ok: true })
})

export default router
