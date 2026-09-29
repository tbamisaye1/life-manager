/**
 * Shared gym domain operations used by the in-app assistant and the MCP server.
 * Keep this as the single source of truth for exercise / routine / workout / set CRUD.
 */
import { db } from '../db/index.js'
import { newId, now, localDateStr } from './helpers.js'
import { resolveGymFields, parseExerciseGoal } from './assistant/gym-notation.js'
import { suggestForExercise } from './gym.js'

// ─── Name matching ───────────────────────────────────────────────────────────

export function normalizeExerciseName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
}

export function exerciseTokens(name) {
  return normalizeExerciseName(name).split(' ').filter(Boolean)
}

/** Ranked match: exact → prefix → all tokens → substring → ILIKE fallback. */
export async function resolveExercise(name, { minScore = 55, includeArchived = false } = {}) {
  const n = normalizeExerciseName(name)
  const tokens = exerciseTokens(name)
  if (!n) return { exercise: null, candidates: [], created: false }

  const rows = includeArchived
    ? await db.prepare('SELECT id, name, unit, category, muscle_group, archived FROM gym_exercises').all()
    : await db.prepare('SELECT id, name, unit, category, muscle_group, archived FROM gym_exercises WHERE archived = 0').all()

  const scored = []
  for (const row of rows) {
    const rn = normalizeExerciseName(row.name)
    let score = -1
    const rtokens = exerciseTokens(row.name)
    if (rn === n) score = 100
    else if (rn.startsWith(n) || rn.endsWith(n)) score = 88
    else if (n.startsWith(rn) || n.endsWith(rn)) score = 82
    else if (rn.includes(n)) score = 80 - Math.min(20, Math.abs(rn.length - n.length) * 0.3)
    else {
      const allMatch = tokens.length > 0 && tokens.every((t) => rtokens.some((rt) => rt === t || rt.includes(t) || t.includes(rt)))
      if (allMatch) {
        // Query tokens are a subset of the library name ("bench" → "MCP Smoke Bench Press").
        // Mild penalty for extras so short spoken names still resolve.
        const extraInRow = rtokens.filter((rt) => !tokens.some((t) => rt === t || rt.includes(t) || t.includes(rt)))
        score = 78 - Math.min(extraInRow.length, 5) * 4 - Math.max(0, tokens.length - rtokens.length) * 6
      } else if (n.includes(rn) && rn.length >= 4) {
        score = 50
      }
    }
    if (score >= minScore) scored.push({ ...row, score })
  }
  scored.sort((a, b) => b.score - a.score || a.name.length - b.name.length)

  if (scored[0]) {
    return {
      exercise: scored[0],
      candidates: scored.slice(0, 5).map(({ score: _s, ...r }) => r),
      created: false,
    }
  }

  // Last resort: SQL ILIKE substring (handles "Smoke Bench" ↔ "MCP Smoke Bench Press")
  const like = await db
    .prepare(
      `SELECT id, name, unit, category, muscle_group, archived FROM gym_exercises
       WHERE ${includeArchived ? '1=1' : 'archived = 0'} AND name ILIKE ?
       ORDER BY length(name) ASC, updated_at DESC LIMIT 5`,
    )
    .all(`%${name.trim()}%`)
  return {
    exercise: like[0] || null,
    candidates: like,
    created: false,
  }
}

export async function findExercise(name) {
  const { exercise } = await resolveExercise(name)
  return exercise
}

export async function ensureExercise(name) {
  const { exercise: found, candidates } = await resolveExercise(name)
  if (found) return { exercise: found, created: false, candidates }
  const ts = now()
  const id = newId()
  const trimmed = name.trim()
  await db
    .prepare(
      `INSERT INTO gym_exercises
         (id, name, category, unit, muscle_group, rep_low, rep_high, default_sets, increment, notes, archived, created_at, updated_at)
       VALUES (@id, @name, 'strength', 'kg', NULL, 8, 12, 3, 2.5, NULL, 0, @ts, @ts)`,
    )
    .run({ id, name: trimmed, ts })
  return { exercise: { id, name: trimmed, unit: 'kg' }, created: true, candidates: [] }
}

async function findRoutineByName(routineName) {
  if (!routineName?.trim()) return null
  return db.prepare('SELECT * FROM gym_routines WHERE name ILIKE ? LIMIT 1').get(`%${routineName.trim()}%`)
}

async function resolveWorkout({ workout_id, date } = {}) {
  if (workout_id) {
    return db.prepare('SELECT * FROM gym_workouts WHERE id = ?').get(workout_id)
  }
  const day = date || localDateStr()
  return db.prepare('SELECT * FROM gym_workouts WHERE date = ? ORDER BY created_at DESC LIMIT 1').get(day)
}

// ─── Sets helpers ────────────────────────────────────────────────────────────

export async function nextSetNumber(workoutId, exerciseId) {
  const row = await db
    .prepare('SELECT MAX(set_number) AS max_set FROM gym_sets WHERE workout_id = ? AND exercise_id = ?')
    .get(workoutId, exerciseId)
  return Number(row?.max_set ?? 0) + 1
}

export async function clearExerciseSets(workoutId, exerciseId) {
  const before = await db
    .prepare('SELECT COUNT(*) AS c FROM gym_sets WHERE workout_id = ? AND exercise_id = ?')
    .get(workoutId, exerciseId)
  await db.prepare('DELETE FROM gym_sets WHERE workout_id = ? AND exercise_id = ?').run(workoutId, exerciseId)
  return Number(before?.c ?? 0)
}

/** Re-number sets 1..N after delete so mobile set badges stay contiguous. */
export async function renumberSets(workoutId, exerciseId) {
  const rows = await db
    .prepare('SELECT id FROM gym_sets WHERE workout_id = ? AND exercise_id = ? ORDER BY set_number, created_at')
    .all(workoutId, exerciseId)
  for (let i = 0; i < rows.length; i++) {
    await db.prepare('UPDATE gym_sets SET set_number = ? WHERE id = ?').run(i + 1, rows[i].id)
  }
  return rows.length
}

export async function insertSet({ workoutId, exerciseId, setNumber, weight, reps, rpe, notes, done = 1 }) {
  const id = newId()
  await db
    .prepare(
      `INSERT INTO gym_sets (id, workout_id, exercise_id, set_number, weight, reps, rpe, done, notes, created_at)
       VALUES (@id, @wid, @ex, @num, @weight, @reps, @rpe, @done, @notes, @ts)`,
    )
    .run({
      id,
      wid: workoutId,
      ex: exerciseId,
      num: setNumber,
      weight: weight ?? null,
      reps: reps ?? null,
      rpe: rpe ?? null,
      done: done ? 1 : 0,
      notes: notes || '',
      ts: now(),
    })
  return id
}

export async function logSetGroup({ workoutId, exerciseId, exerciseUnit, count, reps, weight, rpe, notes, replaceFirst, done = 1 }) {
  let cleared = 0
  let setNumber = 1
  if (replaceFirst) {
    cleared = await clearExerciseSets(workoutId, exerciseId)
  } else {
    setNumber = await nextSetNumber(workoutId, exerciseId)
  }
  const ids = []
  for (let i = 0; i < count; i++) {
    ids.push(
      await insertSet({
        workoutId,
        exerciseId,
        setNumber,
        weight,
        reps,
        rpe,
        notes,
        done,
      }),
    )
    setNumber++
  }
  const per =
    weight != null && reps != null
      ? `${weight}${exerciseUnit} × ${reps}`
      : reps != null
        ? `${reps} reps`
        : weight != null
          ? `${weight}${exerciseUnit}`
          : ''
  return { count, per, cleared, ids }
}

export async function workoutSetSummary(workoutId) {
  const rows = await db
    .prepare(
      `SELECT e.name, e.id AS exercise_id, s.set_number, s.weight, s.reps, s.rpe, s.notes, s.done, s.id AS set_id
       FROM gym_sets s
       JOIN gym_exercises e ON e.id = s.exercise_id
       WHERE s.workout_id = ?
       ORDER BY e.name, s.set_number`,
    )
    .all(workoutId)
  const byEx = new Map()
  for (const r of rows) {
    if (!byEx.has(r.exercise_id)) {
      byEx.set(r.exercise_id, { exercise: r.name, exercise_id: r.exercise_id, sets: 0, set_details: [] })
    }
    const g = byEx.get(r.exercise_id)
    g.sets++
    g.set_details.push({
      set_id: r.set_id,
      set_number: r.set_number,
      weight: r.weight,
      reps: r.reps,
      rpe: r.rpe,
      notes: r.notes,
      done: !!r.done,
    })
  }
  return [...byEx.values()]
}

export async function ensureTodayWorkout(day = localDateStr()) {
  const existing = await db
    .prepare('SELECT id, title, date, completed, notes, routine_id FROM gym_workouts WHERE date = ? ORDER BY created_at DESC LIMIT 1')
    .get(day)
  if (existing) return existing
  const ts = now()
  const id = newId()
  await db
    .prepare(
      `INSERT INTO gym_workouts (id, date, routine_id, title, notes, completed, created_at, updated_at)
       VALUES (@id, @date, NULL, 'Workout', '', 0, @ts, @ts)`,
    )
    .run({ id, date: day, ts })
  return { id, title: 'Workout', date: day, completed: 0, notes: '', routine_id: null }
}

// ─── Exercises ───────────────────────────────────────────────────────────────

export async function listExercises({ category, include_archived = false, query } = {}) {
  let rows
  if (category) {
    rows = include_archived
      ? await db.prepare('SELECT * FROM gym_exercises WHERE category = ? ORDER BY name').all(category)
      : await db.prepare('SELECT * FROM gym_exercises WHERE archived = 0 AND category = ? ORDER BY name').all(category)
  } else {
    rows = include_archived
      ? await db.prepare('SELECT * FROM gym_exercises ORDER BY archived, name').all()
      : await db.prepare('SELECT * FROM gym_exercises WHERE archived = 0 ORDER BY name').all()
  }
  if (query?.trim()) {
    const q = normalizeExerciseName(query)
    rows = rows.filter((r) => normalizeExerciseName(r.name).includes(q) || (r.muscle_group || '').toLowerCase().includes(q))
  }
  return rows
}

export async function getExercise(nameOrId) {
  let row = await db.prepare('SELECT * FROM gym_exercises WHERE id = ?').get(nameOrId)
  if (!row) {
    const found = await findExercise(nameOrId)
    if (found) row = await db.prepare('SELECT * FROM gym_exercises WHERE id = ?').get(found.id)
  }
  return row || null
}

export async function createExercise(fields) {
  const ts = now()
  const id = newId()
  const name = String(fields.name || '').trim()
  if (!name) return { ok: false, message: 'name is required' }
  // Avoid silent duplicates when Claude retries create with the same name.
  const existing = await resolveExercise(name, { minScore: 95 })
  if (existing.exercise && normalizeExerciseName(existing.exercise.name) === normalizeExerciseName(name)) {
    const full = await db.prepare('SELECT * FROM gym_exercises WHERE id = ?').get(existing.exercise.id)
    return { ok: true, id: existing.exercise.id, name: existing.exercise.name, already_existed: true, exercise: full }
  }
  await db
    .prepare(
      `INSERT INTO gym_exercises
         (id, name, category, unit, muscle_group, rep_low, rep_high, default_sets, increment, target_weight, notes, archived, created_at, updated_at)
       VALUES
         (@id, @name, @category, @unit, @muscle_group, @rep_low, @rep_high, @default_sets, @increment, @target_weight, @notes, 0, @ts, @ts)`,
    )
    .run({
      id,
      name,
      category: fields.category || 'strength',
      unit: fields.unit || 'kg',
      muscle_group: fields.muscle_group || null,
      rep_low: fields.rep_low ?? 8,
      rep_high: fields.rep_high ?? 12,
      default_sets: fields.default_sets ?? 3,
      increment: fields.increment ?? 2.5,
      target_weight: fields.target_weight ?? null,
      notes: fields.notes || null,
      ts,
    })
  return { ok: true, id, name, exercise: await db.prepare('SELECT * FROM gym_exercises WHERE id = ?').get(id) }
}

export async function patchExerciseStandard(exercise, fields) {
  const sets = []
  const p = { id: exercise.id, ts: now() }
  const apply = (col, val) => {
    sets.push(`${col} = @${col}`)
    p[col] = val
  }
  if (fields.new_name !== undefined) apply('name', fields.new_name)
  if (fields.category !== undefined) apply('category', fields.category)
  if (fields.unit !== undefined) apply('unit', fields.unit)
  if (fields.muscle_group !== undefined) apply('muscle_group', fields.muscle_group)
  if (fields.rep_low !== undefined) apply('rep_low', fields.rep_low)
  if (fields.rep_high !== undefined) apply('rep_high', fields.rep_high)
  if (fields.default_sets !== undefined) apply('default_sets', fields.default_sets)
  if (fields.target_weight !== undefined) apply('target_weight', fields.target_weight)
  if (fields.increment !== undefined) apply('increment', fields.increment)
  if (fields.notes !== undefined) apply('notes', fields.notes)
  if (fields.archived !== undefined) apply('archived', fields.archived ? 1 : 0)
  if (!sets.length) return { ok: false, message: 'Nothing to update.' }
  await db.prepare(`UPDATE gym_exercises SET ${sets.join(', ')}, updated_at = @ts WHERE id = @id`).run(p)
  return {
    ok: true,
    id: exercise.id,
    name: fields.new_name || exercise.name,
    exercise: await db.prepare('SELECT * FROM gym_exercises WHERE id = ?').get(exercise.id),
  }
}

export async function updateExercise(args) {
  const exercise = await findExercise(args.exercise_name)
  if (!exercise) return { ok: false, message: `No exercise matching "${args.exercise_name}".` }
  const fields = { ...args }
  if (args.goal) Object.assign(fields, parseExerciseGoal(args.goal) || {})
  return patchExerciseStandard(exercise, fields)
}

export async function setExerciseGoal(args) {
  const exercise = await findExercise(args.exercise_name)
  if (!exercise) return { ok: false, message: `No exercise matching "${args.exercise_name}".` }
  const fields = { increment: args.increment, notes: args.notes }
  if (args.goal) {
    const g = parseExerciseGoal(args.goal)
    if (!g) return { ok: false, message: `Couldn't parse goal "${args.goal}". Try "5x10@20kg" or "4 sets of 8".` }
    Object.assign(fields, g)
  }
  if (args.default_sets !== undefined) fields.default_sets = args.default_sets
  if (args.rep_low !== undefined) fields.rep_low = args.rep_low
  if (args.rep_high !== undefined) fields.rep_high = args.rep_high
  if (args.target_weight !== undefined) fields.target_weight = args.target_weight
  return patchExerciseStandard(exercise, fields)
}

export async function appendExerciseNotes({ exercise_name, notes, replace = false }) {
  const exercise = await getExercise(exercise_name)
  if (!exercise) return { ok: false, message: `No exercise matching "${exercise_name}".` }
  const next = replace ? notes || '' : [exercise.notes, notes].filter(Boolean).join('\n')
  return patchExerciseStandard(exercise, { notes: next })
}

export async function deleteExercise(exercise_name) {
  const exercise = await findExercise(exercise_name)
  if (!exercise) return { ok: false, message: `No exercise matching "${exercise_name}".` }
  await db.prepare('DELETE FROM gym_exercises WHERE id = ?').run(exercise.id)
  return { ok: true, id: exercise.id, name: exercise.name }
}

export async function archiveExercise(exercise_name, archived = true) {
  const exercise = await findExercise(exercise_name)
  if (!exercise) return { ok: false, message: `No exercise matching "${exercise_name}".` }
  return patchExerciseStandard(exercise, { archived: archived ? 1 : 0 })
}

export async function getExerciseHistory(exercise_name) {
  const exercise = await getExercise(exercise_name)
  if (!exercise) return { ok: false, message: `No exercise matching "${exercise_name}".` }
  const sessions = await db
    .prepare(
      `SELECT w.id, w.date, w.title,
         MAX(s.weight) AS top_weight,
         SUM(s.weight * s.reps) AS volume,
         COUNT(*) AS set_count
       FROM gym_sets s JOIN gym_workouts w ON w.id = s.workout_id
       WHERE s.exercise_id = ?
       GROUP BY w.id ORDER BY w.date DESC`,
    )
    .all(exercise.id)
  const suggestion = await suggestForExercise(exercise)
  return { ok: true, exercise, sessions, suggestion }
}

// ─── Logging ─────────────────────────────────────────────────────────────────

export async function logExercise(args) {
  const day = args.date || localDateStr()
  const { exercise, created, candidates } = await ensureExercise(args.exercise_name)
  const workout = await ensureTodayWorkout(day)

  const batches =
    Array.isArray(args.groups) && args.groups.length
      ? args.groups.map((g) => resolveGymFields(g))
      : [resolveGymFields({ notation: args.notation, sets: args.sets, reps: args.reps, weight: args.weight })]

  let totalSets = 0
  let first = true
  const details = []
  for (const batch of batches) {
    const count = Math.max(1, Math.min(20, Math.round(Number(batch.sets) || 1)))
    const result = await logSetGroup({
      workoutId: workout.id,
      exerciseId: exercise.id,
      exerciseUnit: exercise.unit,
      count,
      reps: batch.reps ?? null,
      weight: batch.weight ?? null,
      rpe: args.rpe ?? null,
      notes: args.notes,
      replaceFirst: !!args.replace && first,
      done: args.done === false ? 0 : 1,
    })
    totalSets += count
    details.push({ sets: count, reps: batch.reps ?? null, weight: batch.weight ?? null, per: result.per, cleared: result.cleared })
    first = false
  }

  return {
    ok: true,
    workout_id: workout.id,
    exercise: exercise.name,
    exercise_id: exercise.id,
    total_sets: totalSets,
    replaced: !!args.replace,
    matched_from_library: !created,
    auto_created_exercise: created,
    similar_exercises: candidates?.length ? candidates.map((c) => c.name) : undefined,
    details,
  }
}

export async function logSet(args) {
  const day = args.date || localDateStr()
  const { exercise, created } = await ensureExercise(args.exercise_name)
  const workout = await ensureTodayWorkout(day)
  const setNumber = await nextSetNumber(workout.id, exercise.id)
  const setId = await insertSet({
    workoutId: workout.id,
    exerciseId: exercise.id,
    setNumber,
    weight: args.weight,
    reps: args.reps,
    rpe: args.rpe,
    notes: args.notes,
    done: args.done === false ? 0 : 1,
  })
  return {
    ok: true,
    workout_id: workout.id,
    exercise: exercise.name,
    set_id: setId,
    set_number: setNumber,
    auto_created_exercise: created,
  }
}

export async function logSets(args) {
  const fields = resolveGymFields({ notation: args.notation, sets: args.sets, reps: args.reps, weight: args.weight })
  const count = Math.max(1, Math.min(20, Math.round(Number(fields.sets) || 1)))
  const day = args.date || localDateStr()
  const { exercise, created } = await ensureExercise(args.exercise_name)
  const workout = await ensureTodayWorkout(day)
  const { per, cleared } = await logSetGroup({
    workoutId: workout.id,
    exerciseId: exercise.id,
    exerciseUnit: exercise.unit,
    count,
    reps: fields.reps ?? null,
    weight: fields.weight ?? null,
    rpe: args.rpe ?? null,
    notes: args.notes,
    replaceFirst: !!args.replace,
  })
  return {
    ok: true,
    workout_id: workout.id,
    exercise: exercise.name,
    sets: count,
    reps: fields.reps ?? null,
    weight: fields.weight ?? null,
    replaced: !!args.replace,
    cleared,
    auto_created_exercise: created,
    per,
  }
}

export async function updateSet(args) {
  const exercise = await findExercise(args.exercise_name)
  if (!exercise) return { ok: false, message: `No exercise matching "${args.exercise_name}".` }
  const workout = await resolveWorkout({ workout_id: args.workout_id, date: args.date })
  if (!workout) return { ok: false, message: `No workout found.` }
  let set
  if (args.set_id) {
    set = await db.prepare('SELECT * FROM gym_sets WHERE id = ?').get(args.set_id)
  } else {
    set = await db
      .prepare('SELECT * FROM gym_sets WHERE workout_id = ? AND exercise_id = ? AND set_number = ?')
      .get(workout.id, exercise.id, args.set_number)
  }
  if (!set) return { ok: false, message: `No matching set for "${exercise.name}".` }
  const sets = []
  const p = { id: set.id }
  if (args.weight !== undefined) {
    sets.push('weight = @weight')
    p.weight = args.weight
  }
  if (args.reps !== undefined) {
    sets.push('reps = @reps')
    p.reps = args.reps
  }
  if (args.rpe !== undefined) {
    sets.push('rpe = @rpe')
    p.rpe = args.rpe
  }
  if (args.notes !== undefined) {
    sets.push('notes = @notes')
    p.notes = args.notes
  }
  if (args.done !== undefined) {
    sets.push('done = @done')
    p.done = args.done ? 1 : 0
  }
  if (args.append_notes) {
    sets.push('notes = @notes')
    p.notes = [set.notes, args.append_notes].filter(Boolean).join('\n')
  }
  if (!sets.length) return { ok: false, message: 'Nothing to update.' }
  await db.prepare(`UPDATE gym_sets SET ${sets.join(', ')} WHERE id = @id`).run(p)
  return { ok: true, set_id: set.id, exercise: exercise.name, set_number: set.set_number }
}

export async function deleteSet(args) {
  const exercise = await findExercise(args.exercise_name)
  if (!exercise) return { ok: false, message: `No exercise matching "${args.exercise_name}".` }
  const workout = await resolveWorkout({ workout_id: args.workout_id, date: args.date })
  if (!workout) return { ok: false, message: `No workout found.` }
  let set
  if (args.set_id) {
    set = await db.prepare('SELECT * FROM gym_sets WHERE id = ?').get(args.set_id)
  } else {
    set = await db
      .prepare('SELECT * FROM gym_sets WHERE workout_id = ? AND exercise_id = ? AND set_number = ?')
      .get(workout.id, exercise.id, args.set_number)
  }
  if (!set) return { ok: false, message: `No matching set for "${exercise.name}".` }
  await db.prepare('DELETE FROM gym_sets WHERE id = ?').run(set.id)
  await renumberSets(set.workout_id, set.exercise_id)
  return { ok: true, exercise: exercise.name, set_number: set.set_number }
}

export async function clearExerciseSetsOp(args) {
  const day = args.date || localDateStr()
  const exercise = await findExercise(args.exercise_name)
  if (!exercise) return { ok: false, message: `No exercise matching "${args.exercise_name}".` }
  const workout = await resolveWorkout({ workout_id: args.workout_id, date: day })
  if (!workout) return { ok: false, message: `No workout on ${day}.` }
  const removed = await clearExerciseSets(workout.id, exercise.id)
  return { ok: true, exercise: exercise.name, date: workout.date, cleared: removed, workout_id: workout.id }
}

// ─── Workouts ────────────────────────────────────────────────────────────────

export async function getGymToday() {
  const today = localDateStr()
  const dayOfWeek = new Date().getDay()
  const scheduledRoutines = await db
    .prepare('SELECT id, name, emoji, color, notes FROM gym_routines WHERE weekday = ? ORDER BY sort_order')
    .all(dayOfWeek)
  const workouts = await db
    .prepare('SELECT id, title, routine_id, notes, completed FROM gym_workouts WHERE date = ? ORDER BY created_at')
    .all(today)
  const enriched = []
  for (const w of workouts) {
    enriched.push({ ...w, completed: !!w.completed, exercises: await workoutSetSummary(w.id) })
  }
  return { ok: true, date: today, weekday: dayOfWeek, scheduled_routines: scheduledRoutines, workouts: enriched }
}

export async function getGymSchedule() {
  const routines = await db
    .prepare('SELECT id, name, emoji, color, weekday, notes FROM gym_routines WHERE weekday IS NOT NULL ORDER BY weekday, sort_order')
    .all()
  const byDay = {}
  for (const r of routines) (byDay[r.weekday] ||= []).push(r)
  return {
    ok: true,
    days: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ weekday: d, routines: byDay[d] || [] })),
  }
}

export async function listWorkouts({ from, to, limit = 50 } = {}) {
  let rows
  if (from && to) {
    rows = await db
      .prepare(
        'SELECT id, date, title, notes, completed, routine_id FROM gym_workouts WHERE date >= ? AND date <= ? ORDER BY date DESC, created_at DESC',
      )
      .all(from, to)
  } else {
    rows = await db
      .prepare(
        'SELECT id, date, title, notes, completed, routine_id FROM gym_workouts ORDER BY date DESC, created_at DESC LIMIT ?',
      )
      .all(limit)
  }
  return { ok: true, workouts: rows.map((w) => ({ ...w, completed: !!w.completed })) }
}

export async function getWorkout(args = {}) {
  const workout = await resolveWorkout(args)
  if (!workout) return { ok: false, message: 'Workout not found.' }
  const exercises = await workoutSetSummary(workout.id)
  return { ok: true, workout: { ...workout, completed: !!workout.completed }, exercises }
}

export async function startWorkout({ routine_name, date, title, notes } = {}) {
  const day = date || localDateStr()
  const ts = now()
  const id = newId()
  let routineId = null
  let workoutTitle = title || 'Workout'

  if (routine_name) {
    const routine = await findRoutineByName(routine_name)
    if (!routine) return { ok: false, message: `No routine matching "${routine_name}".` }
    routineId = routine.id
    workoutTitle = title || routine.name
  }

  await db
    .prepare(
      `INSERT INTO gym_workouts (id, date, routine_id, title, notes, completed, created_at, updated_at)
       VALUES (@id, @date, @routine_id, @title, @notes, 0, @ts, @ts)`,
    )
    .run({ id, date: day, routine_id: routineId, title: workoutTitle, notes: notes || '', ts })
  return { ok: true, workout_id: id, title: workoutTitle, date: day, routine_id: routineId }
}

export async function finishWorkout({ date, workout_id } = {}) {
  let workout
  if (workout_id) {
    workout = await db.prepare('SELECT id, title FROM gym_workouts WHERE id = ?').get(workout_id)
  } else if (date) {
    workout = await db
      .prepare('SELECT id, title FROM gym_workouts WHERE date = ? AND completed = 0 ORDER BY created_at DESC LIMIT 1')
      .get(date)
  } else {
    workout = await db
      .prepare('SELECT id, title FROM gym_workouts WHERE completed = 0 ORDER BY created_at DESC LIMIT 1')
      .get()
  }
  if (!workout) return { ok: false, message: 'No incomplete workout found.' }
  await db.prepare('UPDATE gym_workouts SET completed = 1, updated_at = ? WHERE id = ?').run(now(), workout.id)
  return { ok: true, workout_id: workout.id, title: workout.title }
}

export async function updateWorkout(args) {
  const workout = await resolveWorkout(args)
  if (!workout) return { ok: false, message: 'No matching workout found.' }
  const sets = []
  const p = { id: workout.id, ts: now() }
  if (args.title !== undefined) {
    sets.push('title = @title')
    p.title = args.title
  }
  if (args.notes !== undefined) {
    sets.push('notes = @notes')
    p.notes = args.notes
  }
  if (args.append_notes) {
    sets.push('notes = @notes')
    p.notes = [workout.notes, args.append_notes].filter(Boolean).join('\n')
  }
  if (args.completed !== undefined) {
    sets.push('completed = @completed')
    p.completed = args.completed ? 1 : 0
  }
  if (args.routine_name !== undefined) {
    if (args.routine_name === null || args.routine_name === '') {
      sets.push('routine_id = NULL')
    } else {
      const routine = await findRoutineByName(args.routine_name)
      if (!routine) return { ok: false, message: `No routine matching "${args.routine_name}".` }
      sets.push('routine_id = @routine_id')
      p.routine_id = routine.id
    }
  }
  if (!sets.length) return { ok: false, message: 'Nothing to update.' }
  await db.prepare(`UPDATE gym_workouts SET ${sets.join(', ')}, updated_at = @ts WHERE id = @id`).run(p)
  return { ok: true, workout_id: workout.id }
}

export async function deleteWorkout({ workout_id, date, all } = {}) {
  let rows
  if (workout_id) {
    rows = await db.prepare('SELECT id FROM gym_workouts WHERE id = ?').all(workout_id)
  } else if (date) {
    rows = await db.prepare('SELECT id FROM gym_workouts WHERE date = ?').all(date)
  } else if (all) {
    rows = await db.prepare('SELECT id FROM gym_workouts').all()
  } else {
    return { ok: false, message: 'Provide workout_id, date, or all:true.' }
  }
  if (!rows.length) return { ok: false, message: 'No matching workouts found.' }
  for (const r of rows) await db.prepare('DELETE FROM gym_workouts WHERE id = ?').run(r.id)
  return { ok: true, deleted: rows.length }
}

// ─── Routines ────────────────────────────────────────────────────────────────

export async function listRoutines() {
  const routines = await db
    .prepare('SELECT id, name, emoji, color, weekday, notes, sort_order FROM gym_routines ORDER BY sort_order, name')
    .all()
  const result = []
  for (const r of routines) {
    const exercises = await db
      .prepare(
        `SELECT re.id AS routine_exercise_id, re.target_sets, re.sort_order, e.id AS exercise_id, e.name, e.unit, e.category
         FROM gym_routine_exercises re
         JOIN gym_exercises e ON e.id = re.exercise_id
         WHERE re.routine_id = ?
         ORDER BY re.sort_order`,
      )
      .all(r.id)
    result.push({ ...r, exercises })
  }
  return { ok: true, routines: result }
}

export async function getRoutine(routine_name) {
  const routine = await findRoutineByName(routine_name)
  if (!routine) return { ok: false, message: `No routine matching "${routine_name}".` }
  const { routines } = await listRoutines()
  const full = routines.find((r) => r.id === routine.id)
  return { ok: true, routine: full }
}

export async function createRoutine(args) {
  const ts = now()
  const id = newId()
  const name = String(args.name || '').trim()
  if (!name) return { ok: false, message: 'name is required' }
  const maxRow = await db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM gym_routines').get()
  const sortOrder = Number(maxRow?.m ?? -1) + 1
  await db
    .prepare(
      `INSERT INTO gym_routines (id, name, emoji, color, weekday, notes, sort_order, created_at, updated_at)
       VALUES (@id, @name, @emoji, @color, @weekday, @notes, @sort_order, @ts, @ts)`,
    )
    .run({
      id,
      name,
      emoji: args.emoji || '🏋️',
      color: args.color || 'violet',
      weekday: args.weekday ?? null,
      notes: args.notes || '',
      sort_order: sortOrder,
      ts,
    })
  return { ok: true, id, name }
}

export async function updateRoutine(args) {
  const routine = await findRoutineByName(args.routine_name)
  if (!routine) return { ok: false, message: `No routine matching "${args.routine_name}".` }
  const sets = []
  const p = { id: routine.id, ts: now() }
  if (args.new_name !== undefined) {
    sets.push('name = @name')
    p.name = args.new_name
  }
  if (args.weekday !== undefined) {
    sets.push('weekday = @weekday')
    p.weekday = args.weekday
  }
  if (args.emoji !== undefined) {
    sets.push('emoji = @emoji')
    p.emoji = args.emoji
  }
  if (args.color !== undefined) {
    sets.push('color = @color')
    p.color = args.color
  }
  if (args.notes !== undefined) {
    sets.push('notes = @notes')
    p.notes = args.notes
  }
  if (args.append_notes) {
    sets.push('notes = @notes')
    p.notes = [routine.notes, args.append_notes].filter(Boolean).join('\n')
  }
  if (args.sort_order !== undefined) {
    sets.push('sort_order = @sort_order')
    p.sort_order = args.sort_order
  }
  if (!sets.length) return { ok: false, message: 'Nothing to update.' }
  await db.prepare(`UPDATE gym_routines SET ${sets.join(', ')}, updated_at = @ts WHERE id = @id`).run(p)
  return { ok: true, id: routine.id, name: args.new_name || routine.name }
}

export async function deleteRoutine(routine_name) {
  const routine = await findRoutineByName(routine_name)
  if (!routine) return { ok: false, message: `No routine matching "${routine_name}".` }
  await db.prepare('DELETE FROM gym_routines WHERE id = ?').run(routine.id)
  return { ok: true, id: routine.id, name: routine.name }
}

export async function addExerciseToRoutine(args) {
  const routine = await findRoutineByName(args.routine_name)
  if (!routine) return { ok: false, message: `No routine matching "${args.routine_name}".` }
  let exercise = await findExercise(args.exercise_name)
  if (!exercise && args.create_if_missing) {
    const created = await ensureExercise(args.exercise_name)
    exercise = created.exercise
  }
  if (!exercise) return { ok: false, message: `No exercise matching "${args.exercise_name}".` }

  const existing = await db
    .prepare('SELECT id FROM gym_routine_exercises WHERE routine_id = ? AND exercise_id = ?')
    .get(routine.id, exercise.id)
  if (existing) {
    if (args.target_sets != null) {
      await db.prepare('UPDATE gym_routine_exercises SET target_sets = ? WHERE id = ?').run(args.target_sets, existing.id)
    }
    return { ok: true, id: existing.id, routine: routine.name, exercise: exercise.name, already_present: true }
  }

  const maxRow = await db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM gym_routine_exercises WHERE routine_id = ?')
    .get(routine.id)
  const sortOrder = args.sort_order ?? Number(maxRow?.m ?? -1) + 1
  const id = newId()
  await db
    .prepare(
      `INSERT INTO gym_routine_exercises (id, routine_id, exercise_id, target_sets, sort_order)
       VALUES (@id, @routine_id, @exercise_id, @target_sets, @sort_order)`,
    )
    .run({
      id,
      routine_id: routine.id,
      exercise_id: exercise.id,
      target_sets: args.target_sets ?? 3,
      sort_order: sortOrder,
    })
  return { ok: true, id, routine: routine.name, exercise: exercise.name }
}

export async function removeExerciseFromRoutine(args) {
  const routine = await findRoutineByName(args.routine_name)
  if (!routine) return { ok: false, message: `No routine matching "${args.routine_name}".` }
  const link = await db
    .prepare(
      `SELECT re.id, e.name FROM gym_routine_exercises re
       JOIN gym_exercises e ON e.id = re.exercise_id
       WHERE re.routine_id = ? AND e.name ILIKE ? LIMIT 1`,
    )
    .get(routine.id, `%${args.exercise_name}%`)
  if (!link) return { ok: false, message: `"${args.exercise_name}" is not in routine "${routine.name}".` }
  await db.prepare('DELETE FROM gym_routine_exercises WHERE id = ?').run(link.id)
  return { ok: true, routine: routine.name, exercise: link.name }
}

export async function updateRoutineExercise(args) {
  const routine = await findRoutineByName(args.routine_name)
  if (!routine) return { ok: false, message: `No routine matching "${args.routine_name}".` }
  const link = await db
    .prepare(
      `SELECT re.id, re.target_sets, re.sort_order, e.name FROM gym_routine_exercises re
       JOIN gym_exercises e ON e.id = re.exercise_id
       WHERE re.routine_id = ? AND e.name ILIKE ? LIMIT 1`,
    )
    .get(routine.id, `%${args.exercise_name}%`)
  if (!link) return { ok: false, message: `"${args.exercise_name}" is not in routine "${routine.name}".` }
  const sets = []
  const p = { id: link.id }
  if (args.target_sets !== undefined) {
    sets.push('target_sets = @target_sets')
    p.target_sets = args.target_sets
  }
  if (args.sort_order !== undefined) {
    sets.push('sort_order = @sort_order')
    p.sort_order = args.sort_order
  }
  if (!sets.length) return { ok: false, message: 'Nothing to update.' }
  await db.prepare(`UPDATE gym_routine_exercises SET ${sets.join(', ')} WHERE id = @id`).run(p)
  return { ok: true, routine: routine.name, exercise: link.name, target_sets: args.target_sets ?? link.target_sets }
}

export async function reorderRoutineExercises(args) {
  const routine = await findRoutineByName(args.routine_name)
  if (!routine) return { ok: false, message: `No routine matching "${args.routine_name}".` }
  const names = args.exercise_names || []
  if (!names.length) return { ok: false, message: 'exercise_names required (ordered list).' }
  for (let i = 0; i < names.length; i++) {
    const link = await db
      .prepare(
        `SELECT re.id FROM gym_routine_exercises re
         JOIN gym_exercises e ON e.id = re.exercise_id
         WHERE re.routine_id = ? AND e.name ILIKE ? LIMIT 1`,
      )
      .get(routine.id, `%${names[i]}%`)
    if (link) await db.prepare('UPDATE gym_routine_exercises SET sort_order = ? WHERE id = ?').run(i, link.id)
  }
  return { ok: true, routine: routine.name, order: names }
}

export async function createRoutineFromWorkout(args) {
  const workout = await resolveWorkout(args)
  if (!workout) return { ok: false, message: 'Workout not found.' }
  const rows = await db
    .prepare(
      `SELECT s.exercise_id, COUNT(*) AS set_count
       FROM gym_sets s WHERE s.workout_id = ?
       GROUP BY s.exercise_id ORDER BY MIN(s.set_number)`,
    )
    .all(workout.id)
  if (!rows.length) return { ok: false, message: 'Workout has no logged exercises.' }

  const ts = now()
  const id = newId()
  const name = (args.name || workout.title || 'Workout').trim()
  await db
    .prepare(
      `INSERT INTO gym_routines (id, name, emoji, color, weekday, notes, sort_order, created_at, updated_at)
       VALUES (@id, @name, @emoji, @color, @weekday, @notes, 0, @ts, @ts)`,
    )
    .run({
      id,
      name,
      emoji: args.emoji || '🏋️',
      color: args.color || 'violet',
      weekday: args.weekday ?? null,
      notes: args.notes || workout.notes || '',
      ts,
    })
  for (let i = 0; i < rows.length; i++) {
    const ex = await db.prepare('SELECT default_sets FROM gym_exercises WHERE id = ?').get(rows[i].exercise_id)
    const targetSets = rows[i].set_count || ex?.default_sets || 3
    await db
      .prepare('INSERT INTO gym_routine_exercises (id, routine_id, exercise_id, target_sets, sort_order) VALUES (?,?,?,?,?)')
      .run(newId(), id, rows[i].exercise_id, targetSets, i)
  }
  return { ok: true, id, name }
}
