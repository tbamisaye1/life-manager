import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { newId, now, localDateStr } from '../helpers.js'

export function buildGymTools({ record }) {
  // -------------------------------------------------------------------------
  // list_exercises
  // -------------------------------------------------------------------------
  const listExercises = tool(
    async ({ category }) => {
      let rows
      if (category) {
        rows = await db
          .prepare('SELECT id, name, category, unit FROM gym_exercises WHERE archived = 0 AND category = ? ORDER BY name')
          .all(category)
      } else {
        rows = await db
          .prepare('SELECT id, name, category, unit FROM gym_exercises WHERE archived = 0 ORDER BY name')
          .all()
      }
      return JSON.stringify({ ok: true, exercises: rows })
    },
    {
      name: 'list_exercises',
      description: 'List all non-archived exercises, optionally filtered by category.',
      schema: z.object({
        category: z
          .enum(['strength', 'rehab', 'mobility', 'conditioning'])
          .optional()
          .describe('Filter by category; omit for all'),
      }),
    },
  )

  // -------------------------------------------------------------------------
  // create_exercise
  // -------------------------------------------------------------------------
  const createExercise = tool(
    async ({ name, category, unit, muscle_group, rep_low, rep_high, default_sets, increment, notes }) => {
      const ts = now()
      const id = newId()
      await db
        .prepare(
          `INSERT INTO gym_exercises
             (id, name, category, unit, muscle_group, rep_low, rep_high, default_sets, increment, notes, archived, created_at, updated_at)
           VALUES
             (@id, @name, @category, @unit, @muscle_group, @rep_low, @rep_high, @default_sets, @increment, @notes, 0, @ts, @ts)`,
        )
        .run({
          id,
          name,
          category: category || 'strength',
          unit: unit || 'kg',
          muscle_group: muscle_group || null,
          rep_low: rep_low ?? 8,
          rep_high: rep_high ?? 12,
          default_sets: default_sets ?? 3,
          increment: increment ?? 2.5,
          notes: notes || null,
          ts,
        })
      record(`🆕 Added exercise "${name}"`)
      return JSON.stringify({ ok: true, id, name })
    },
    {
      name: 'create_exercise',
      description: 'Create a new exercise definition.',
      schema: z.object({
        name: z.string(),
        category: z.enum(['strength', 'rehab', 'mobility', 'conditioning']).optional(),
        unit: z.enum(['kg', 'lb', 'bodyweight', 'band', 'time']).optional(),
        muscle_group: z.string().optional(),
        rep_low: z.number().int().optional(),
        rep_high: z.number().int().optional(),
        default_sets: z.number().int().optional(),
        increment: z.number().optional(),
        notes: z.string().optional(),
      }),
    },
  )

  // -------------------------------------------------------------------------
  // Shared gym-logging helpers (used by log_set and log_sets)
  // -------------------------------------------------------------------------

  function normalizeExerciseName(name) {
    return name.trim().toLowerCase().replace(/[-–—]/g, ' ').replace(/\s+/g, ' ')
  }

  function exerciseTokens(name) {
    return normalizeExerciseName(name).split(' ').filter(Boolean)
  }

  // Ranked matching: exact (incl. hyphen/space variants) → prefix → all query
  // tokens present → substring. Prefers shorter names on ties so "pull ups"
  // beats "slow pull-ups" when the user said "pull ups", but "slow pull ups"
  // still resolves to "slow pull-ups".
  async function findExercise(name) {
    const n = normalizeExerciseName(name)
    const tokens = exerciseTokens(name)
    if (!n) return null

    const rows = await db.prepare('SELECT id, name, unit FROM gym_exercises WHERE archived = 0').all()
    let best = null
    let bestScore = -1

    for (const row of rows) {
      const rn = normalizeExerciseName(row.name)
      let score = -1

      if (rn === n) score = 100
      else if (rn.startsWith(n)) score = 85
      else if (n.startsWith(rn)) score = 80
      else {
        const rtokens = exerciseTokens(row.name)
        const allMatch = tokens.every((t) => rtokens.some((rt) => rt === t || rt.includes(t) || t.includes(rt)))
        if (allMatch) {
          score = 65 - (rtokens.length - tokens.length) * 8 - Math.abs(rn.length - n.length) * 0.05
        } else if (rn.includes(n) || n.includes(rn)) {
          score = 45 - Math.abs(rn.length - n.length) * 0.05
        }
      }

      if (score > bestScore || (score === bestScore && best && row.name.length < best.name.length)) {
        bestScore = score
        best = row
      }
    }

    return bestScore > 0 ? best : null
  }

  async function ensureExercise(name) {
    const found = await findExercise(name)
    if (found) return { exercise: found, created: false }
    const ts = now()
    const id = newId()
    await db
      .prepare(`INSERT INTO gym_exercises (id, name, category, unit, muscle_group, rep_low, rep_high, default_sets, increment, notes, archived, created_at, updated_at)
        VALUES (@id, @name, 'strength', 'kg', NULL, 8, 12, 3, 2.5, NULL, 0, @ts, @ts)`)
      .run({ id, name: name.trim(), ts })
    return { exercise: { id, name: name.trim(), unit: 'kg' }, created: true }
  }

  async function ensureTodayWorkout(day) {
    const existing = await db.prepare('SELECT id FROM gym_workouts WHERE date = ? ORDER BY created_at DESC LIMIT 1').get(day)
    if (existing) return existing
    const ts = now()
    const id = newId()
    await db
      .prepare(`INSERT INTO gym_workouts (id, date, routine_id, title, notes, completed, created_at, updated_at)
        VALUES (@id, @date, NULL, 'Workout', '', 0, @ts, @ts)`)
      .run({ id, date: day, ts })
    return { id }
  }

  async function nextSetNumber(workoutId, exerciseId) {
    const row = await db.prepare('SELECT MAX(set_number) AS max_set FROM gym_sets WHERE workout_id = ? AND exercise_id = ?').get(workoutId, exerciseId)
    return Number(row?.max_set ?? 0) + 1
  }

  async function clearExerciseSets(workoutId, exerciseId) {
    const before = await db
      .prepare('SELECT COUNT(*) AS c FROM gym_sets WHERE workout_id = ? AND exercise_id = ?')
      .get(workoutId, exerciseId)
    await db.prepare('DELETE FROM gym_sets WHERE workout_id = ? AND exercise_id = ?').run(workoutId, exerciseId)
    return Number(before?.c ?? 0)
  }

  async function workoutSetSummary(workoutId) {
    const rows = await db
      .prepare(
        `SELECT e.name, e.id AS exercise_id, COUNT(s.id) AS set_count,
                MAX(s.weight) AS weight, MAX(s.reps) AS reps
         FROM gym_sets s
         JOIN gym_exercises e ON e.id = s.exercise_id
         WHERE s.workout_id = ?
         GROUP BY e.id, e.name
         ORDER BY MIN(s.set_number)`,
      )
      .all(workoutId)
    return rows.map((r) => ({
      exercise: r.name,
      exercise_id: r.exercise_id,
      sets: Number(r.set_count),
      weight: r.weight,
      reps: r.reps,
    }))
  }

  async function insertSet({ workoutId, exerciseId, setNumber, weight, reps, notes }) {
    await db
      .prepare(`INSERT INTO gym_sets (id, workout_id, exercise_id, set_number, weight, reps, rpe, done, notes, created_at)
        VALUES (@id, @wid, @ex, @num, @weight, @reps, NULL, 1, @notes, @ts)`)
      .run({ id: newId(), wid: workoutId, ex: exerciseId, num: setNumber, weight: weight ?? null, reps: reps ?? null, notes: notes || '', ts: now() })
  }

  // -------------------------------------------------------------------------
  // log_set  (one set)
  // -------------------------------------------------------------------------
  const logSet = tool(
    async ({ exercise_name, weight, reps, date, notes }) => {
      const day = date || localDateStr()
      const { exercise, created } = await ensureExercise(exercise_name)
      if (created) record(`🆕 Added exercise "${exercise.name}"`)
      const workout = await ensureTodayWorkout(day)
      const setNumber = await nextSetNumber(workout.id, exercise.id)
      await insertSet({ workoutId: workout.id, exerciseId: exercise.id, setNumber, weight, reps, notes })

      const label = weight != null && reps != null ? `${weight}${exercise.unit} × ${reps}` : weight != null ? `${weight}${exercise.unit}` : reps != null ? `${reps} reps` : 'set'
      record(`🏋️ Logged ${exercise.name} — ${label}`)
      return JSON.stringify({ ok: true, workout_id: workout.id, exercise: exercise.name, set_number: setNumber, auto_created_exercise: created })
    },
    {
      name: 'log_set',
      description:
        "Log a SINGLE set for an exercise. If the user gives a set COUNT (e.g. '3 sets of 10'), use log_sets instead. Resolves the exercise by name (creates it if missing), finds or creates today's workout, and appends one set.",
      schema: z.object({
        exercise_name: z.string().describe('Full or partial exercise name'),
        weight: z.number().optional().describe('Weight used (unit matches exercise)'),
        reps: z.number().int().optional(),
        date: z.string().optional().describe('YYYY-MM-DD; defaults to today'),
        notes: z.string().optional().describe('a note for this set, e.g. "felt heavy"'),
      }),
    },
  )

  // -------------------------------------------------------------------------
  // log_sets  (MANY identical sets in ONE call — exact count, no looping)
  // -------------------------------------------------------------------------
  const logSets = tool(
    async ({ exercise_name, sets, reps, weight, date, notes, replace }) => {
      const count = Math.max(1, Math.min(20, Math.round(Number(sets))))
      const day = date || localDateStr()
      const { exercise, created } = await ensureExercise(exercise_name)
      if (created) record(`🆕 Added exercise "${exercise.name}"`)
      const workout = await ensureTodayWorkout(day)
      let setNumber = 1
      if (replace) {
        const removed = await clearExerciseSets(workout.id, exercise.id)
        if (removed) record(`🗑️ Cleared ${removed} existing set${removed === 1 ? '' : 's'} for "${exercise.name}"`)
      } else {
        setNumber = await nextSetNumber(workout.id, exercise.id)
      }
      for (let i = 0; i < count; i++) {
        await insertSet({ workoutId: workout.id, exerciseId: exercise.id, setNumber, weight, reps, notes })
        setNumber++
      }
      const per = weight != null && reps != null ? `${weight}${exercise.unit} × ${reps}` : reps != null ? `${reps} reps` : weight != null ? `${weight}${exercise.unit}` : ''
      record(`🏋️ Logged ${exercise.name} — ${count} sets${per ? ` of ${per}` : ''}`)
      return JSON.stringify({ ok: true, exercise: exercise.name, sets: count, reps: reps ?? null, weight: weight ?? null, replaced: !!replace, auto_created_exercise: created })
    },
    {
      name: 'log_sets',
      description:
        "Log MANY identical sets in one call. Use replace:true when the user wants to CHANGE an exercise's set count (e.g. 'change to 5 sets', 'make it 5x5', 'update to 5 sets of 5') — that clears existing sets for that exercise in today's workout first, then logs exactly `sets` new ones. Without replace, sets are APPENDED after any already logged. ALWAYS use this (not repeated log_set) when the user states a set count.",
      schema: z.object({
        exercise_name: z.string().describe('Full or partial exercise name'),
        sets: z.number().int().min(1).max(20).describe('EXACT number of sets to create'),
        reps: z.number().int().optional().describe('reps per set'),
        weight: z.number().optional().describe('weight per set (unit matches exercise)'),
        date: z.string().optional().describe('YYYY-MM-DD; defaults to today'),
        notes: z.string().optional(),
        replace: z.boolean().optional().describe('true = clear this exercise\'s existing sets in the workout first, then log exactly `sets` new ones'),
      }),
    },
  )

  // -------------------------------------------------------------------------
  // get_gym_today
  // -------------------------------------------------------------------------
  const getGymToday = tool(
    async () => {
      const today = localDateStr()
      const dayOfWeek = new Date().getDay() // 0=Sun..6=Sat

      const scheduledRoutines = await db
        .prepare('SELECT id, name, emoji, color FROM gym_routines WHERE weekday = ? ORDER BY sort_order')
        .all(dayOfWeek)

      const workouts = await db
        .prepare('SELECT id, title, routine_id, completed FROM gym_workouts WHERE date = ? ORDER BY created_at')
        .all(today)

      const enriched = []
      for (const w of workouts) {
        enriched.push({ ...w, exercises: await workoutSetSummary(w.id) })
      }

      return JSON.stringify({ ok: true, date: today, weekday: dayOfWeek, scheduled_routines: scheduledRoutines, workouts: enriched })
    },
    {
      name: 'get_gym_today',
      description: "Return today's date, scheduled routines, and any workouts logged today — including each exercise's current set count. Call this before changing or removing workout entries so you know what's already logged.",
      schema: z.object({}),
    },
  )

  // -------------------------------------------------------------------------
  // list_routines
  // -------------------------------------------------------------------------
  const listRoutines = tool(
    async () => {
      const routines = await db
        .prepare('SELECT id, name, emoji, color, weekday, sort_order FROM gym_routines ORDER BY sort_order')
        .all()

      const result = []
      for (const r of routines) {
        const exercises = await db
          .prepare(
            `SELECT e.name FROM gym_routine_exercises re
             JOIN gym_exercises e ON e.id = re.exercise_id
             WHERE re.routine_id = ?
             ORDER BY re.sort_order`,
          )
          .all(r.id)
        result.push({ ...r, exercises: exercises.map((e) => e.name) })
      }

      return JSON.stringify({ ok: true, routines: result })
    },
    {
      name: 'list_routines',
      description: 'List all routines with their exercise names.',
      schema: z.object({}),
    },
  )

  // -------------------------------------------------------------------------
  // create_routine
  // -------------------------------------------------------------------------
  const createRoutine = tool(
    async ({ name, weekday, emoji, color }) => {
      const ts = now()
      const id = newId()
      const maxRow = await db
        .prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM gym_routines')
        .get()
      const sortOrder = Number(maxRow?.m ?? -1) + 1

      await db
        .prepare(
          `INSERT INTO gym_routines (id, name, emoji, color, weekday, notes, sort_order, created_at, updated_at)
           VALUES (@id, @name, @emoji, @color, @weekday, '', @sort_order, @ts, @ts)`,
        )
        .run({
          id,
          name,
          emoji: emoji || '🏋️',
          color: color || 'violet',
          weekday: weekday ?? null,
          sort_order: sortOrder,
          ts,
        })
      record(`🏋️ Created routine "${name}"`)
      return JSON.stringify({ ok: true, id, name })
    },
    {
      name: 'create_routine',
      description: 'Create a new workout routine.',
      schema: z.object({
        name: z.string(),
        weekday: z.number().int().min(0).max(6).optional().describe('0=Sun … 6=Sat; omit for unscheduled'),
        emoji: z.string().optional(),
        color: z.string().optional(),
      }),
    },
  )

  // -------------------------------------------------------------------------
  // add_exercise_to_routine
  // -------------------------------------------------------------------------
  const addExerciseToRoutine = tool(
    async ({ routine_name, exercise_name, target_sets }) => {
      const routine = await db
        .prepare('SELECT id, name FROM gym_routines WHERE name ILIKE ? LIMIT 1')
        .get(`%${routine_name}%`)
      if (!routine) return JSON.stringify({ ok: false, message: `No routine matching "${routine_name}".` })

      const exercise = await db
        .prepare('SELECT id, name FROM gym_exercises WHERE name ILIKE ? AND archived = 0 LIMIT 1')
        .get(`%${exercise_name}%`)
      if (!exercise) return JSON.stringify({ ok: false, message: `No exercise matching "${exercise_name}".` })

      const maxRow = await db
        .prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM gym_routine_exercises WHERE routine_id = ?')
        .get(routine.id)
      const sortOrder = Number(maxRow?.m ?? -1) + 1

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
          target_sets: target_sets ?? 3,
          sort_order: sortOrder,
        })
      record(`➕ Added "${exercise.name}" to routine "${routine.name}"`)
      return JSON.stringify({ ok: true, id, routine: routine.name, exercise: exercise.name })
    },
    {
      name: 'add_exercise_to_routine',
      description: 'Add an exercise to a routine (both resolved by name ILIKE).',
      schema: z.object({
        routine_name: z.string(),
        exercise_name: z.string(),
        target_sets: z.number().int().optional().describe('Default 3'),
      }),
    },
  )

  // -------------------------------------------------------------------------
  // start_workout
  // -------------------------------------------------------------------------
  const startWorkout = tool(
    async ({ routine_name, date }) => {
      const day = date || localDateStr()
      const ts = now()
      const id = newId()

      let routineId = null
      let title = 'Workout'

      if (routine_name) {
        const routine = await db
          .prepare('SELECT id, name FROM gym_routines WHERE name ILIKE ? LIMIT 1')
          .get(`%${routine_name}%`)
        if (!routine) return JSON.stringify({ ok: false, message: `No routine matching "${routine_name}".` })
        routineId = routine.id
        title = routine.name
      }

      await db
        .prepare(
          `INSERT INTO gym_workouts (id, date, routine_id, title, notes, completed, created_at, updated_at)
           VALUES (@id, @date, @routine_id, @title, '', 0, @ts, @ts)`,
        )
        .run({ id, date: day, routine_id: routineId, title, ts })

      record(`💪 Started workout${title !== 'Workout' ? ` "${title}"` : ''}`)
      return JSON.stringify({ ok: true, workout_id: id, title, date: day })
    },
    {
      name: 'start_workout',
      description: 'Create a new workout session for a date (defaults to today). Optionally link to a routine.',
      schema: z.object({
        routine_name: z.string().optional().describe('Routine name (partial match ok); omit for ad-hoc'),
        date: z.string().optional().describe('YYYY-MM-DD; defaults to today'),
      }),
    },
  )

  // -------------------------------------------------------------------------
  // finish_workout
  // -------------------------------------------------------------------------
  const finishWorkout = tool(
    async ({ date }) => {
      let workout
      if (date) {
        workout = await db
          .prepare(
            'SELECT id, title FROM gym_workouts WHERE date = ? AND completed = 0 ORDER BY created_at DESC LIMIT 1',
          )
          .get(date)
      } else {
        workout = await db
          .prepare(
            'SELECT id, title FROM gym_workouts WHERE completed = 0 ORDER BY created_at DESC LIMIT 1',
          )
          .get()
      }

      if (!workout) {
        return JSON.stringify({ ok: false, message: 'No incomplete workout found.' })
      }

      await db
        .prepare('UPDATE gym_workouts SET completed = 1, updated_at = ? WHERE id = ?')
        .run(now(), workout.id)

      record(`✅ Finished workout${workout.title ? ` "${workout.title}"` : ''}`)
      return JSON.stringify({ ok: true, workout_id: workout.id, title: workout.title })
    },
    {
      name: 'finish_workout',
      description: 'Mark the most recent incomplete workout as completed.',
      schema: z.object({
        date: z.string().optional().describe('YYYY-MM-DD to narrow search; omit for most recent overall'),
      }),
    },
  )

  // -------------------------------------------------------------------------
  // list_workouts
  // -------------------------------------------------------------------------
  const listWorkouts = tool(
    async ({ from, to, limit }) => {
      let rows
      if (from && to) {
        rows = await db
          .prepare('SELECT id, date, title, completed FROM gym_workouts WHERE date >= ? AND date <= ? ORDER BY date DESC, created_at DESC')
          .all(from, to)
      } else {
        rows = await db
          .prepare('SELECT id, date, title, completed FROM gym_workouts ORDER BY date DESC, created_at DESC LIMIT ?')
          .all(limit ?? 50)
      }
      return JSON.stringify({ ok: true, workouts: rows })
    },
    {
      name: 'list_workouts',
      description: 'List workouts (most recent first) with their ids — use before deleting. Optionally bound by a date range.',
      schema: z.object({
        from: z.string().optional().describe('YYYY-MM-DD inclusive'),
        to: z.string().optional().describe('YYYY-MM-DD inclusive'),
        limit: z.number().int().optional().describe('Max rows when no range given (default 50)'),
      }),
    },
  )

  // -------------------------------------------------------------------------
  // clear_exercise_sets — remove logged sets for one exercise from a workout
  // -------------------------------------------------------------------------
  const clearExerciseSetsTool = tool(
    async ({ exercise_name, date }) => {
      const day = date || localDateStr()
      const exercise = await findExercise(exercise_name)
      if (!exercise) return JSON.stringify({ ok: false, message: `No exercise matching "${exercise_name}".` })
      const workout = await db
        .prepare('SELECT id FROM gym_workouts WHERE date = ? ORDER BY created_at DESC LIMIT 1')
        .get(day)
      if (!workout) return JSON.stringify({ ok: false, message: `No workout on ${day}.` })
      const removed = await clearExerciseSets(workout.id, exercise.id)
      if (removed) record(`🗑️ Cleared ${removed} set${removed === 1 ? '' : 's'} for "${exercise.name}" from ${day}'s workout`)
      else record(`ℹ️ No sets to clear for "${exercise.name}" on ${day}`)
      return JSON.stringify({ ok: true, exercise: exercise.name, date: day, cleared: removed })
    },
    {
      name: 'clear_exercise_sets',
      description:
        "Remove all logged sets for one exercise from a workout (defaults to today's). Use to drop a duplicate/wrong entry from today's workout WITHOUT deleting the exercise definition or the whole workout. Prefer this over delete_exercise when cleaning up a workout log.",
      schema: z.object({
        exercise_name: z.string(),
        date: z.string().optional().describe('YYYY-MM-DD; defaults to today'),
      }),
    },
  )

  // -------------------------------------------------------------------------
  // delete_workout — by id, by date, or all. Cascades to its sets.
  // -------------------------------------------------------------------------
  const deleteWorkout = tool(
    async ({ workout_id, date, all }) => {
      let rows
      if (workout_id) {
        rows = await db.prepare('SELECT id FROM gym_workouts WHERE id = ?').all(workout_id)
      } else if (date) {
        rows = await db.prepare('SELECT id FROM gym_workouts WHERE date = ?').all(date)
      } else if (all) {
        rows = await db.prepare('SELECT id FROM gym_workouts').all()
      } else {
        return JSON.stringify({ ok: false, message: 'Provide workout_id, date, or all:true.' })
      }
      if (rows.length === 0) return JSON.stringify({ ok: false, message: 'No matching workouts found.' })
      for (const r of rows) await db.prepare('DELETE FROM gym_workouts WHERE id = ?').run(r.id)
      record(`🗑️ Deleted ${rows.length} workout${rows.length === 1 ? '' : 's'}`)
      return JSON.stringify({ ok: true, deleted: rows.length })
    },
    {
      name: 'delete_workout',
      description: 'Delete workouts (and their logged sets). Target ONE of: workout_id, date (all workouts that day), or all:true (every workout). Use list_workouts first to confirm.',
      schema: z.object({
        workout_id: z.string().optional(),
        date: z.string().optional().describe('YYYY-MM-DD — delete every workout on this date'),
        all: z.boolean().optional().describe('Delete ALL workouts'),
      }),
    },
  )

  // -------------------------------------------------------------------------
  // delete_exercise — by name. Cascades to its sets + routine links.
  // -------------------------------------------------------------------------
  const deleteExercise = tool(
    async ({ exercise_name }) => {
      const exercise = await findExercise(exercise_name)
      if (!exercise) return JSON.stringify({ ok: false, message: `No exercise matching "${exercise_name}".` })
      await db.prepare('DELETE FROM gym_exercises WHERE id = ?').run(exercise.id)
      record(`🗑️ Deleted exercise "${exercise.name}"`)
      return JSON.stringify({ ok: true, id: exercise.id, name: exercise.name })
    },
    {
      name: 'delete_exercise',
      description: 'Delete an exercise from the library (and all its logged sets everywhere). Only use when the user wants the exercise gone entirely — NOT for removing a duplicate entry from today\'s workout (use clear_exercise_sets instead).',
      schema: z.object({ exercise_name: z.string() }),
    },
  )

  // -------------------------------------------------------------------------
  // update_exercise — edit the standard (rep range, sets, unit, notes, …)
  // -------------------------------------------------------------------------
  const updateExercise = tool(
    async ({ exercise_name, new_name, category, unit, muscle_group, rep_low, rep_high, default_sets, increment, notes }) => {
      const exercise = await findExercise(exercise_name)
      if (!exercise) return JSON.stringify({ ok: false, message: `No exercise matching "${exercise_name}".` })
      const sets = []
      const p = { id: exercise.id, ts: now() }
      if (new_name !== undefined) { sets.push('name = @name'); p.name = new_name }
      if (category !== undefined) { sets.push('category = @category'); p.category = category }
      if (unit !== undefined) { sets.push('unit = @unit'); p.unit = unit }
      if (muscle_group !== undefined) { sets.push('muscle_group = @muscle_group'); p.muscle_group = muscle_group }
      if (rep_low !== undefined) { sets.push('rep_low = @rep_low'); p.rep_low = rep_low }
      if (rep_high !== undefined) { sets.push('rep_high = @rep_high'); p.rep_high = rep_high }
      if (default_sets !== undefined) { sets.push('default_sets = @default_sets'); p.default_sets = default_sets }
      if (increment !== undefined) { sets.push('increment = @increment'); p.increment = increment }
      if (notes !== undefined) { sets.push('notes = @notes'); p.notes = notes }
      if (!sets.length) return JSON.stringify({ ok: false, message: 'Nothing to update.' })
      await db.prepare(`UPDATE gym_exercises SET ${sets.join(', ')}, updated_at = @ts WHERE id = @id`).run(p)
      record(`✏️ Updated exercise "${new_name || exercise.name}"`)
      return JSON.stringify({ ok: true, id: exercise.id })
    },
    {
      name: 'update_exercise',
      description: "Edit an exercise's standard (resolved by name): rename, rep range, default sets, weight increment, unit, muscle group, category, or notes/cues.",
      schema: z.object({
        exercise_name: z.string().describe('current name fragment'),
        new_name: z.string().optional(),
        category: z.enum(['strength', 'rehab', 'mobility', 'conditioning']).optional(),
        unit: z.enum(['kg', 'lb', 'bodyweight', 'band', 'time']).optional(),
        muscle_group: z.string().optional(),
        rep_low: z.number().int().optional(),
        rep_high: z.number().int().optional(),
        default_sets: z.number().int().optional(),
        increment: z.number().optional(),
        notes: z.string().optional(),
      }),
    },
  )

  // -------------------------------------------------------------------------
  // update_routine — rename, reschedule, recolour
  // -------------------------------------------------------------------------
  const updateRoutine = tool(
    async ({ routine_name, new_name, weekday, emoji, color, notes }) => {
      const routine = await db
        .prepare('SELECT id, name FROM gym_routines WHERE name ILIKE ? LIMIT 1')
        .get(`%${routine_name}%`)
      if (!routine) return JSON.stringify({ ok: false, message: `No routine matching "${routine_name}".` })
      const sets = []
      const p = { id: routine.id, ts: now() }
      if (new_name !== undefined) { sets.push('name = @name'); p.name = new_name }
      if (weekday !== undefined) { sets.push('weekday = @weekday'); p.weekday = weekday }
      if (emoji !== undefined) { sets.push('emoji = @emoji'); p.emoji = emoji }
      if (color !== undefined) { sets.push('color = @color'); p.color = color }
      if (notes !== undefined) { sets.push('notes = @notes'); p.notes = notes }
      if (!sets.length) return JSON.stringify({ ok: false, message: 'Nothing to update.' })
      await db.prepare(`UPDATE gym_routines SET ${sets.join(', ')}, updated_at = @ts WHERE id = @id`).run(p)
      record(`✏️ Updated routine "${new_name || routine.name}"`)
      return JSON.stringify({ ok: true, id: routine.id })
    },
    {
      name: 'update_routine',
      description: 'Edit a routine (resolved by name): rename, change its scheduled weekday (0=Sun…6=Sat, null=unscheduled), emoji, colour, or notes.',
      schema: z.object({
        routine_name: z.string().describe('current name fragment'),
        new_name: z.string().optional(),
        weekday: z.number().int().min(0).max(6).nullable().optional(),
        emoji: z.string().optional(),
        color: z.string().optional(),
        notes: z.string().optional(),
      }),
    },
  )

  // -------------------------------------------------------------------------
  // remove_exercise_from_routine
  // -------------------------------------------------------------------------
  const removeExerciseFromRoutine = tool(
    async ({ routine_name, exercise_name }) => {
      const routine = await db.prepare('SELECT id, name FROM gym_routines WHERE name ILIKE ? LIMIT 1').get(`%${routine_name}%`)
      if (!routine) return JSON.stringify({ ok: false, message: `No routine matching "${routine_name}".` })
      const link = await db
        .prepare(`SELECT re.id, e.name FROM gym_routine_exercises re JOIN gym_exercises e ON e.id = re.exercise_id
          WHERE re.routine_id = ? AND e.name ILIKE ? LIMIT 1`)
        .get(routine.id, `%${exercise_name}%`)
      if (!link) return JSON.stringify({ ok: false, message: `"${exercise_name}" is not in routine "${routine.name}".` })
      await db.prepare('DELETE FROM gym_routine_exercises WHERE id = ?').run(link.id)
      record(`➖ Removed "${link.name}" from "${routine.name}"`)
      return JSON.stringify({ ok: true, routine: routine.name, exercise: link.name })
    },
    {
      name: 'remove_exercise_from_routine',
      description: 'Remove an exercise from a routine (both resolved by name). Does not delete the exercise itself.',
      schema: z.object({ routine_name: z.string(), exercise_name: z.string() }),
    },
  )

  // -------------------------------------------------------------------------
  // delete_routine — by name.
  // -------------------------------------------------------------------------
  const deleteRoutine = tool(
    async ({ routine_name }) => {
      const routine = await db
        .prepare('SELECT id, name FROM gym_routines WHERE name ILIKE ? LIMIT 1')
        .get(`%${routine_name}%`)
      if (!routine) return JSON.stringify({ ok: false, message: `No routine matching "${routine_name}".` })
      await db.prepare('DELETE FROM gym_routines WHERE id = ?').run(routine.id)
      record(`🗑️ Deleted routine "${routine.name}"`)
      return JSON.stringify({ ok: true, id: routine.id, name: routine.name })
    },
    {
      name: 'delete_routine',
      description: 'Delete a routine (resolved by name ILIKE). Does not delete the exercises themselves.',
      schema: z.object({ routine_name: z.string() }),
    },
  )

  return [
    listExercises,
    createExercise,
    logSet,
    logSets,
    getGymToday,
    listRoutines,
    createRoutine,
    addExerciseToRoutine,
    startWorkout,
    finishWorkout,
    listWorkouts,
    deleteWorkout,
    clearExerciseSetsTool,
    deleteExercise,
    deleteRoutine,
    updateExercise,
    updateRoutine,
    removeExerciseFromRoutine,
  ]
}
