import { Router } from 'express'
import { db } from '../db/index.js'
import { newId, now, buildUpdate, mapRows, decodeBooleans, localDateStr } from '../lib/helpers.js'
import { httpError } from '../lib/http.js'
import { suggestForExercise, lastPerformance, formatLastSummary } from '../lib/gym.js'

const router = Router()

function parsePlannedIds(raw) {
  if (!raw) return null
  if (Array.isArray(raw)) return raw.filter(Boolean)
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(Boolean) : null
  } catch {
    return null
  }
}

// ---------------- Exercise library ----------------
const EX_ALLOWED = ['name', 'category', 'muscle_group', 'unit', 'rep_low', 'rep_high', 'default_sets', 'target_weight', 'increment', 'notes', 'archived']

router.get('/exercises', async (req, res) => {
  const { category } = req.query
  const rows = category
    ? await db.prepare('SELECT * FROM gym_exercises WHERE archived = 0 AND category = ? ORDER BY name').all(category)
    : await db.prepare('SELECT * FROM gym_exercises WHERE archived = 0 ORDER BY category, name').all()
  res.json(mapRows(rows, ['archived']))
})

router.post('/exercises', async (req, res) => {
  const { name } = req.body
  if (!name?.trim()) return res.status(400).json(httpError('Name is required', 'VALIDATION'))
  const ts = now(); const id = newId()
  await db.prepare(`INSERT INTO gym_exercises (id,name,category,muscle_group,unit,rep_low,rep_high,default_sets,increment,target_weight,notes,archived,created_at,updated_at)
    VALUES (@id,@name,@category,@muscle_group,@unit,@rep_low,@rep_high,@default_sets,@increment,@target_weight,@notes,0,@ts,@ts)`).run({
    id, name: name.trim(), category: req.body.category || 'strength', muscle_group: req.body.muscle_group || null,
    unit: req.body.unit || 'kg', rep_low: req.body.rep_low ?? 8, rep_high: req.body.rep_high ?? 12,
    default_sets: req.body.default_sets ?? 3, increment: req.body.increment ?? 2.5,
    target_weight: req.body.target_weight ?? null, notes: req.body.notes || '', ts,
  })
  res.status(201).json(await db.prepare('SELECT * FROM gym_exercises WHERE id = ?').get(id))
})

router.patch('/exercises/:id', async (req, res) => {
  const upd = buildUpdate('gym_exercises', req.params.id, req.body, EX_ALLOWED)
  if (upd) await db.prepare(upd.sql).run(upd.params)
  res.json(await db.prepare('SELECT * FROM gym_exercises WHERE id = ?').get(req.params.id))
})

router.delete('/exercises/:id', async (req, res) => {
  await db.prepare('DELETE FROM gym_exercises WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// Progress history for one exercise: top set per session over time + suggestion.
router.get('/exercises/:id/history', async (req, res) => {
  const exercise = await db.prepare('SELECT * FROM gym_exercises WHERE id = ?').get(req.params.id)
  if (!exercise) return res.status(404).json(httpError('Exercise not found', 'NOT_FOUND'))
  const sessions = await db.prepare(`
    SELECT w.id, w.date,
      MAX(s.weight) AS top_weight,
      SUM(s.weight * s.reps) AS volume,
      COUNT(*) AS set_count
    FROM gym_sets s JOIN gym_workouts w ON w.id = s.workout_id
    WHERE s.exercise_id = ?
    GROUP BY w.id ORDER BY w.date`).all(req.params.id)
  res.json({ exercise, sessions, suggestion: await suggestForExercise(exercise) })
})

// ---------------- Routines (day templates) ----------------
async function routineWithExercises(routine, { withLast = false } = {}) {
  const exercises = await db.prepare(`
    SELECT re.id AS routine_exercise_id, re.target_sets, re.sort_order, e.*
    FROM gym_routine_exercises re JOIN gym_exercises e ON e.id = re.exercise_id
    WHERE re.routine_id = ? ORDER BY re.sort_order`).all(routine.id)
  if (!withLast) return { ...routine, exercises }
  const enriched = await Promise.all(
    exercises.map(async (ex) => {
      const last = await lastPerformance(ex.id)
      return { ...ex, last: formatLastSummary(last, ex.unit) }
    }),
  )
  return { ...routine, exercises: enriched }
}

router.get('/routines', async (req, res) => {
  const routines = await db.prepare('SELECT * FROM gym_routines ORDER BY (weekday IS NULL), weekday, sort_order').all()
  res.json(await Promise.all(routines.map((r) => routineWithExercises(r))))
})

/** Single routine with last-session blurb per exercise — for the start-workout picker. */
router.get('/routines/:id', async (req, res) => {
  const routine = await db.prepare('SELECT * FROM gym_routines WHERE id = ?').get(req.params.id)
  if (!routine) return res.status(404).json(httpError('Routine not found', 'NOT_FOUND'))
  res.json(await routineWithExercises(routine, { withLast: true }))
})

router.post('/routines', async (req, res) => {
  const { name } = req.body
  if (!name?.trim()) return res.status(400).json(httpError('Name is required', 'VALIDATION'))
  const ts = now(); const id = newId()
  await db.prepare(`INSERT INTO gym_routines (id,name,emoji,color,weekday,notes,sort_order,created_at,updated_at)
    VALUES (@id,@name,@emoji,@color,@weekday,@notes,0,@ts,@ts)`).run({
    id, name: name.trim(), emoji: req.body.emoji || '🏋️', color: req.body.color || 'violet',
    weekday: req.body.weekday ?? null, notes: req.body.notes || '', ts,
  })
  res.status(201).json(await routineWithExercises(await db.prepare('SELECT * FROM gym_routines WHERE id = ?').get(id)))
})

router.patch('/routines/:id', async (req, res) => {
  const upd = buildUpdate('gym_routines', req.params.id, req.body, ['name', 'emoji', 'color', 'weekday', 'notes', 'sort_order'])
  if (upd) await db.prepare(upd.sql).run(upd.params)
  const routine = await db.prepare('SELECT * FROM gym_routines WHERE id = ?').get(req.params.id)
  res.json(routine ? await routineWithExercises(routine) : null)
})

router.delete('/routines/:id', async (req, res) => {
  await db.prepare('DELETE FROM gym_routines WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

router.post('/routines/:id/exercises', async (req, res) => {
  const { exercise_id } = req.body
  if (!exercise_id) return res.status(400).json(httpError('exercise_id required', 'VALIDATION'))
  const max = (await db.prepare('SELECT COALESCE(MAX(sort_order),-1) m FROM gym_routine_exercises WHERE routine_id = ?').get(req.params.id)).m
  await db.prepare('INSERT INTO gym_routine_exercises (id,routine_id,exercise_id,target_sets,sort_order) VALUES (?,?,?,?,?)')
    .run(newId(), req.params.id, exercise_id, req.body.target_sets ?? 3, max + 1)
  const routine = await db.prepare('SELECT * FROM gym_routines WHERE id = ?').get(req.params.id)
  res.status(201).json(await routineWithExercises(routine))
})

router.patch('/routines/:id/exercises/:rexId', async (req, res) => {
  const link = await db.prepare('SELECT * FROM gym_routine_exercises WHERE id = ? AND routine_id = ?').get(req.params.rexId, req.params.id)
  if (!link) return res.status(404).json(httpError('Routine exercise not found', 'NOT_FOUND'))
  const fields = ['target_sets', 'sort_order'].filter((f) => f in req.body)
  if (fields.length) {
    const sql = `UPDATE gym_routine_exercises SET ${fields.map((f) => `${f} = @${f}`).join(', ')} WHERE id = @id`
    await db.prepare(sql).run({ ...req.body, id: req.params.rexId })
  }
  const routine = await db.prepare('SELECT * FROM gym_routines WHERE id = ?').get(req.params.id)
  res.json(routine ? await routineWithExercises(routine) : null)
})

router.delete('/routines/:id/exercises/:rexId', async (req, res) => {
  await db.prepare('DELETE FROM gym_routine_exercises WHERE id = ?').run(req.params.rexId)
  const routine = await db.prepare('SELECT * FROM gym_routines WHERE id = ?').get(req.params.id)
  res.json(routine ? await routineWithExercises(routine) : { ok: true })
})

/** Build a routine template from a logged workout's exercises. */
router.post('/routines/from-workout/:workoutId', async (req, res) => {
  const workout = await db.prepare('SELECT * FROM gym_workouts WHERE id = ?').get(req.params.workoutId)
  if (!workout) return res.status(404).json(httpError('Workout not found', 'NOT_FOUND'))

  const rows = await db.prepare(`
    SELECT s.exercise_id, COUNT(*) AS set_count
    FROM gym_sets s
    WHERE s.workout_id = ?
    GROUP BY s.exercise_id
    ORDER BY MIN(s.set_number)`).all(req.params.workoutId)
  if (!rows.length) return res.status(400).json(httpError('Workout has no logged exercises', 'VALIDATION'))

  const ts = now()
  const id = newId()
  const name = (req.body.name || workout.title || 'Workout').trim()
  await db.prepare(`INSERT INTO gym_routines (id,name,emoji,color,weekday,notes,sort_order,created_at,updated_at)
    VALUES (@id,@name,@emoji,@color,@weekday,@notes,0,@ts,@ts)`).run({
    id,
    name,
    emoji: req.body.emoji || '🏋️',
    color: req.body.color || 'violet',
    weekday: req.body.weekday ?? null,
    notes: req.body.notes || workout.notes || '',
    ts,
  })

  for (let i = 0; i < rows.length; i++) {
    const ex = await db.prepare('SELECT default_sets FROM gym_exercises WHERE id = ?').get(rows[i].exercise_id)
    const targetSets = rows[i].set_count || ex?.default_sets || 3
    await db.prepare('INSERT INTO gym_routine_exercises (id,routine_id,exercise_id,target_sets,sort_order) VALUES (?,?,?,?,?)')
      .run(newId(), id, rows[i].exercise_id, targetSets, i)
  }

  const routine = await db.prepare('SELECT * FROM gym_routines WHERE id = ?').get(id)
  res.status(201).json(await routineWithExercises(routine))
})

// ---------------- Schedule + Today ----------------
router.get('/schedule', async (req, res) => {
  const routines = await db.prepare('SELECT id,name,emoji,color,weekday FROM gym_routines WHERE weekday IS NOT NULL ORDER BY weekday').all()
  const byDay = {}
  for (const r of routines) (byDay[r.weekday] ||= []).push(r)
  res.json({ days: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ weekday: d, routines: byDay[d] || [] })) })
})

router.get('/today', async (req, res) => {
  const date = localDateStr()
  const weekday = new Date().getDay()
  const scheduled = await db.prepare('SELECT * FROM gym_routines WHERE weekday = ? ORDER BY sort_order').all(weekday)
  const todays = await db.prepare('SELECT * FROM gym_workouts WHERE date = ? ORDER BY created_at DESC').all(date)
  res.json({
    date, weekday,
    scheduled: scheduled.map((r) => ({ id: r.id, name: r.name, emoji: r.emoji, color: r.color })),
    workouts: mapRows(todays, ['completed']),
  })
})

// ---------------- Workouts + set logging ----------------
router.get('/workouts', async (req, res) => {
  const { date, from, to } = req.query
  let rows
  if (date) {
    rows = await db.prepare('SELECT * FROM gym_workouts WHERE date = ? ORDER BY created_at DESC').all(date)
  } else if (from && to) {
    rows = await db.prepare('SELECT * FROM gym_workouts WHERE date >= ? AND date <= ? ORDER BY date, created_at').all(from, to)
  } else {
    rows = await db.prepare('SELECT * FROM gym_workouts ORDER BY date DESC, created_at DESC LIMIT 30').all()
  }
  res.json(mapRows(rows, ['completed']))
})

async function plannedExercisesForWorkout(workout) {
  const plannedIds = parsePlannedIds(workout.planned_exercise_ids)
  if (workout.routine_id) {
    let planned = await db.prepare(`SELECT e.*, re.target_sets FROM gym_routine_exercises re JOIN gym_exercises e ON e.id = re.exercise_id
      WHERE re.routine_id = ? ORDER BY re.sort_order`).all(workout.routine_id)
    if (plannedIds?.length) {
      const allow = new Set(plannedIds)
      planned = planned.filter((e) => allow.has(e.id))
      const have = new Set(planned.map((e) => e.id))
      for (const id of plannedIds) {
        if (have.has(id)) continue
        const ex = await db.prepare('SELECT * FROM gym_exercises WHERE id = ?').get(id)
        if (ex) planned.push(ex)
      }
    }
    return planned
  }
  if (plannedIds?.length) {
    const rows = []
    for (const id of plannedIds) {
      const ex = await db.prepare('SELECT * FROM gym_exercises WHERE id = ?').get(id)
      if (ex) rows.push(ex)
    }
    return rows
  }
  return []
}

router.get('/workouts/:id', async (req, res) => {
  const workout = await db.prepare('SELECT * FROM gym_workouts WHERE id = ?').get(req.params.id)
  if (!workout) return res.status(404).json(httpError('Workout not found', 'NOT_FOUND'))

  const planned = await plannedExercisesForWorkout(workout)
  const loggedExerciseIds = (await db.prepare('SELECT DISTINCT exercise_id FROM gym_sets WHERE workout_id = ?').all(req.params.id)).map((r) => r.exercise_id)
  const ids = new Set(planned.map((e) => e.id))
  const extras = await Promise.all(
    loggedExerciseIds
      .filter((id) => !ids.has(id))
      .map((id) => db.prepare('SELECT * FROM gym_exercises WHERE id = ?').get(id))
  ).then((rows) => rows.filter(Boolean))

  const exercises = await Promise.all([...planned, ...extras].map(async (ex) => {
    const targetSets = ex.target_sets ?? ex.default_sets
    const suggestion = await suggestForExercise(ex, workout.id, targetSets)
    const sets = (await db.prepare('SELECT * FROM gym_sets WHERE workout_id = ? AND exercise_id = ? ORDER BY set_number')
      .all(req.params.id, ex.id)).map((s) => decodeBooleans(s, ['done']))
    return {
      exercise: { ...ex, target_sets: undefined },
      target_sets: targetSets,
      suggestion,
      sets,
    }
  }))

  const decoded = decodeBooleans(workout, ['completed'])
  decoded.planned_exercise_ids = parsePlannedIds(workout.planned_exercise_ids)
  res.json({ ...decoded, exercises })
})

router.post('/workouts', async (req, res) => {
  const ts = now(); const id = newId()
  const routine = req.body.routine_id ? await db.prepare('SELECT name FROM gym_routines WHERE id = ?').get(req.body.routine_id) : null
  const exerciseIds = Array.isArray(req.body.exercise_ids)
    ? req.body.exercise_ids.filter(Boolean)
    : null
  // Empty array = nothing selected. Omit / null = all routine exercises.
  if (exerciseIds && exerciseIds.length === 0) {
    return res.status(400).json(httpError('Pick at least one exercise', 'VALIDATION'))
  }
  const plannedJson = exerciseIds ? JSON.stringify(exerciseIds) : null
  await db.prepare(`INSERT INTO gym_workouts (id,date,routine_id,title,notes,completed,planned_exercise_ids,created_at,updated_at)
    VALUES (@id,@date,@routine_id,@title,'',0,@planned,@ts,@ts)`).run({
    id, date: req.body.date || localDateStr(), routine_id: req.body.routine_id || null,
    title: req.body.title || routine?.name || 'Workout', planned: plannedJson, ts,
  })
  const row = await db.prepare('SELECT * FROM gym_workouts WHERE id = ?').get(id)
  const decoded = decodeBooleans(row, ['completed'])
  decoded.planned_exercise_ids = parsePlannedIds(row.planned_exercise_ids)
  res.status(201).json(decoded)
})

router.patch('/workouts/:id', async (req, res) => {
  const patch = { ...req.body }
  if ('completed' in patch) patch.completed = patch.completed ? 1 : 0
  if (Array.isArray(patch.exercise_ids)) {
    patch.planned_exercise_ids = JSON.stringify(patch.exercise_ids.filter(Boolean))
    delete patch.exercise_ids
  }
  const upd = buildUpdate('gym_workouts', req.params.id, patch, ['title', 'notes', 'completed', 'routine_id', 'planned_exercise_ids'])
  if (upd) await db.prepare(upd.sql).run(upd.params)
  const row = await db.prepare('SELECT * FROM gym_workouts WHERE id = ?').get(req.params.id)
  const decoded = decodeBooleans(row, ['completed'])
  if (row) decoded.planned_exercise_ids = parsePlannedIds(row.planned_exercise_ids)
  res.json(decoded)
})

router.delete('/workouts/:id', async (req, res) => {
  await db.prepare('DELETE FROM gym_workouts WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

router.post('/workouts/:id/sets', async (req, res) => {
  const { exercise_id } = req.body
  if (!exercise_id) return res.status(400).json(httpError('exercise_id required', 'VALIDATION'))
  const nextNum = (await db.prepare('SELECT COALESCE(MAX(set_number),0)+1 n FROM gym_sets WHERE workout_id = ? AND exercise_id = ?')
    .get(req.params.id, exercise_id)).n
  const id = newId()
  await db.prepare(`INSERT INTO gym_sets (id,workout_id,exercise_id,set_number,weight,reps,rpe,done,notes,created_at)
    VALUES (@id,@wid,@ex,@num,@weight,@reps,@rpe,@done,@notes,@ts)`).run({
    id, wid: req.params.id, ex: exercise_id, num: req.body.set_number ?? nextNum,
    weight: req.body.weight ?? null, reps: req.body.reps ?? null, rpe: req.body.rpe ?? null,
    done: req.body.done === false || req.body.done === 0 ? 0 : 1,
    notes: req.body.notes || '', ts: now(),
  })
  res.status(201).json(decodeBooleans(await db.prepare('SELECT * FROM gym_sets WHERE id = ?').get(id), ['done']))
})

router.patch('/sets/:setId', async (req, res) => {
  const patch = { ...req.body }
  if ('done' in patch) patch.done = patch.done ? 1 : 0
  const fields = ['weight', 'reps', 'rpe', 'done', 'set_number', 'notes'].filter((f) => f in patch)
  if (fields.length) {
    const sql = `UPDATE gym_sets SET ${fields.map((f) => `${f} = @${f}`).join(', ')} WHERE id = @id`
    await db.prepare(sql).run({ ...patch, id: req.params.setId })
  }
  res.json(decodeBooleans(await db.prepare('SELECT * FROM gym_sets WHERE id = ?').get(req.params.setId), ['done']))
})

router.delete('/sets/:setId', async (req, res) => {
  const set = await db.prepare('SELECT workout_id, exercise_id FROM gym_sets WHERE id = ?').get(req.params.setId)
  await db.prepare('DELETE FROM gym_sets WHERE id = ?').run(req.params.setId)
  if (set) {
    const rows = await db
      .prepare('SELECT id FROM gym_sets WHERE workout_id = ? AND exercise_id = ? ORDER BY set_number, created_at')
      .all(set.workout_id, set.exercise_id)
    for (let i = 0; i < rows.length; i++) {
      await db.prepare('UPDATE gym_sets SET set_number = ? WHERE id = ?').run(i + 1, rows[i].id)
    }
  }
  res.json({ ok: true })
})

export default router
