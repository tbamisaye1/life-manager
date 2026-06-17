import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { newId, now, localDateStr } from '../helpers.js'
import { resolveGymFields, parseExerciseGoal } from './gym-notation.js'

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
    const { exercise } = await resolveExercise(name)
    return exercise
  }

  async function resolveExercise(name, { minScore = 55 } = {}) {
    const n = normalizeExerciseName(name)
    const tokens = exerciseTokens(name)
    if (!n) return { exercise: null, candidates: [], created: false }

    const rows = await db.prepare('SELECT id, name, unit FROM gym_exercises WHERE archived = 0').all()
    const scored = []
    for (const row of rows) {
      const rn = normalizeExerciseName(row.name)
      let score = -1
      const rtokens = exerciseTokens(row.name)
      if (rn === n) score = 100
      else if (rn.startsWith(n)) score = 85
      else if (n.startsWith(rn)) score = 80
      else {
        const allMatch = tokens.every((t) => rtokens.some((rt) => rt === t || rt.includes(t) || t.includes(rt)))
        if (allMatch) {
          const extraInRow = rtokens.filter((rt) => !tokens.some((t) => rt === t || rt.includes(t) || t.includes(rt)))
          score = 72 - extraInRow.length * 22 - Math.abs(rtokens.length - tokens.length) * 6
        } else if (rn.includes(n) || n.includes(rn)) {
          score = 45 - Math.abs(rn.length - n.length) * 0.05
        }
      }
      if (score >= minScore) scored.push({ ...row, score })
    }
    scored.sort((a, b) => b.score - a.score || a.name.length - b.name.length)
    return { exercise: scored[0] || null, candidates: scored.slice(0, 5).map(({ score: _s, ...r }) => r) }
  }

  async function ensureExercise(name) {
    const { exercise: found, candidates } = await resolveExercise(name)
    if (found) return { exercise: found, created: false, candidates }
    const ts = now()
    const id = newId()
    await db
      .prepare(`INSERT INTO gym_exercises (id, name, category, unit, muscle_group, rep_low, rep_high, default_sets, increment, notes, archived, created_at, updated_at)
        VALUES (@id, @name, 'strength', 'kg', NULL, 8, 12, 3, 2.5, NULL, 0, @ts, @ts)`)
      .run({ id, name: name.trim(), ts })
    return { exercise: { id, name: name.trim(), unit: 'kg' }, created: true, candidates: [] }
  }

  async function logSetGroup({ workoutId, exerciseId, exerciseUnit, count, reps, weight, notes, replaceFirst }) {
    let cleared = 0
    let setNumber = 1
    if (replaceFirst) {
      cleared = await clearExerciseSets(workoutId, exerciseId)
    } else {
      setNumber = await nextSetNumber(workoutId, exerciseId)
    }
    for (let i = 0; i < count; i++) {
      await insertSet({ workoutId, exerciseId, setNumber, weight, reps, notes })
      setNumber++
    }
    const per = weight != null && reps != null ? `${weight}${exerciseUnit} × ${reps}` : reps != null ? `${reps} reps` : weight != null ? `${weight}${exerciseUnit}` : ''
    return { count, per, cleared }
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
        `SELECT e.name, e.id AS exercise_id, s.set_number, s.weight, s.reps
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
      g.set_details.push({ set_number: r.set_number, weight: r.weight, reps: r.reps })
    }
    return [...byEx.values()]
  }

  async function insertSet({ workoutId, exerciseId, setNumber, weight, reps, notes }) {
    await db
      .prepare(`INSERT INTO gym_sets (id, workout_id, exercise_id, set_number, weight, reps, rpe, done, notes, created_at)
        VALUES (@id, @wid, @ex, @num, @weight, @reps, NULL, 1, @notes, @ts)`)
      .run({ id: newId(), wid: workoutId, ex: exerciseId, num: setNumber, weight: weight ?? null, reps: reps ?? null, notes: notes || '', ts: now() })
  }

  // -------------------------------------------------------------------------
  // log_exercise — primary logging tool (notation + multi-weight groups)
  // -------------------------------------------------------------------------
  const GROUP_SCHEMA = z.object({
    notation: z.string().optional().describe('e.g. "3x10@12.5kg", "2 sets of 6 at 26kg"'),
    sets: z.number().int().optional(),
    reps: z.number().int().optional(),
    weight: z.number().optional(),
  })

  const logExercise = tool(
    async ({ exercise_name, notation, sets, reps, weight, groups, replace, date, notes }) => {
      const day = date || localDateStr()
      const { exercise, created, candidates } = await ensureExercise(exercise_name)
      if (created) record(`🆕 Added exercise "${exercise.name}"`)
      const workout = await ensureTodayWorkout(day)

      const batches = Array.isArray(groups) && groups.length
        ? groups.map((g) => resolveGymFields(g))
        : [resolveGymFields({ notation, sets, reps, weight })]

      let totalSets = 0
      let first = true
      for (const batch of batches) {
        const count = Math.max(1, Math.min(20, Math.round(Number(batch.sets) || 1)))
        const { per } = await logSetGroup({
          workoutId: workout.id,
          exerciseId: exercise.id,
          exerciseUnit: exercise.unit,
          count,
          reps: batch.reps ?? null,
          weight: batch.weight ?? null,
          notes,
          replaceFirst: !!replace && first,
        })
        totalSets += count
        const label = per ? `${count} sets of ${per}` : `${count} sets`
        record(`🏋️ Logged ${exercise.name} — ${label}`)
        first = false
      }

      return JSON.stringify({
        ok: true,
        exercise: exercise.name,
        total_sets: totalSets,
        replaced: !!replace,
        matched_from_library: !created,
        similar_exercises: candidates?.length ? candidates.map((c) => c.name) : undefined,
      })
    },
    {
      name: 'log_exercise',
      description:
        'PRIMARY gym logging tool. Log sets using gym shorthand in `notation` — e.g. "5x10@20kg", "3x6 at 30kg", "4 sets of 5". For different weights in one exercise use `groups`: [{notation:"3x10@12.5kg"},{notation:"2x10@20kg"}]. Set replace:true when CORRECTING an exercise (clears old sets first). ALWAYS pass the full exercise name the user said (e.g. "slow pull-ups", not just "pull ups").',
      schema: z.object({
        exercise_name: z.string().describe('Exercise name exactly as the user said it'),
        notation: z.string().optional().describe('Sets/reps/weight shorthand for a single batch'),
        sets: z.number().int().optional(),
        reps: z.number().int().optional(),
        weight: z.number().optional(),
        groups: z.array(GROUP_SCHEMA).optional().describe('Multiple weight batches for the same exercise'),
        replace: z.boolean().optional().describe('true when changing/fixing set count — clears existing sets first'),
        date: z.string().optional(),
        notes: z.string().optional(),
      }),
    },
  )

  const resolveExerciseTool = tool(
    async ({ name }) => {
      const { exercise, candidates } = await resolveExercise(name)
      return JSON.stringify({
        best_match: exercise?.name ?? null,
        candidates: candidates.map((c) => c.name),
        will_create_new: !exercise,
      })
    },
    {
      name: 'resolve_exercise',
      description: 'Check which library exercise matches a name BEFORE logging. Use when the user names an exercise that might already exist under a slightly different spelling.',
      schema: z.object({ name: z.string() }),
    },
  )

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
    async ({ exercise_name, notation, sets, reps, weight, date, notes, replace }) => {
      const fields = resolveGymFields({ notation, sets, reps, weight })
      const count = Math.max(1, Math.min(20, Math.round(Number(fields.sets) || 1)))
      const day = date || localDateStr()
      const { exercise, created } = await ensureExercise(exercise_name)
      if (created) record(`🆕 Added exercise "${exercise.name}"`)
      const workout = await ensureTodayWorkout(day)
      const { per, cleared } = await logSetGroup({
        workoutId: workout.id,
        exerciseId: exercise.id,
        exerciseUnit: exercise.unit,
        count,
        reps: fields.reps ?? null,
        weight: fields.weight ?? null,
        notes,
        replaceFirst: !!replace,
      })
      if (cleared) record(`🗑️ Cleared ${cleared} existing set${cleared === 1 ? '' : 's'} for "${exercise.name}"`)
      record(`🏋️ Logged ${exercise.name} — ${count} sets${per ? ` of ${per}` : ''}`)
      return JSON.stringify({ ok: true, exercise: exercise.name, sets: count, reps: fields.reps ?? null, weight: fields.weight ?? null, replaced: !!replace })
    },
    {
      name: 'log_sets',
      description:
        'Log many identical sets in one call. Prefer log_exercise instead — it handles shorthand notation and multiple weight groups. Use replace:true when changing set counts.',
      schema: z.object({
        exercise_name: z.string(),
        notation: z.string().optional().describe('e.g. "5x10@20kg" — parsed into sets/reps/weight'),
        sets: z.number().int().min(1).max(20).optional(),
        reps: z.number().int().optional(),
        weight: z.number().optional(),
        date: z.string().optional(),
        notes: z.string().optional(),
        replace: z.boolean().optional(),
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
      description: "Return today's workout with per-set detail (set_number, weight, reps) for each exercise. Call before changing or removing sets.",
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
  // update_set / delete_set — edit individual logged sets
  // -------------------------------------------------------------------------
  const updateSet = tool(
    async ({ exercise_name, set_number, date, weight, reps, notes }) => {
      const exercise = await findExercise(exercise_name)
      if (!exercise) return JSON.stringify({ ok: false, message: `No exercise matching "${exercise_name}".` })
      const day = date || localDateStr()
      const workout = await db.prepare('SELECT id FROM gym_workouts WHERE date = ? ORDER BY created_at DESC LIMIT 1').get(day)
      if (!workout) return JSON.stringify({ ok: false, message: `No workout on ${day}.` })
      const set = await db
        .prepare('SELECT id FROM gym_sets WHERE workout_id = ? AND exercise_id = ? AND set_number = ?')
        .get(workout.id, exercise.id, set_number)
      if (!set) return JSON.stringify({ ok: false, message: `No set ${set_number} for "${exercise.name}" on ${day}.` })
      const sets = []
      const p = { id: set.id }
      if (weight !== undefined) { sets.push('weight = @weight'); p.weight = weight }
      if (reps !== undefined) { sets.push('reps = @reps'); p.reps = reps }
      if (notes !== undefined) { sets.push('notes = @notes'); p.notes = notes }
      if (!sets.length) return JSON.stringify({ ok: false, message: 'Nothing to update.' })
      await db.prepare(`UPDATE gym_sets SET ${sets.join(', ')} WHERE id = @id`).run(p)
      record(`✏️ Updated ${exercise.name} set ${set_number}`)
      return JSON.stringify({ ok: true, set_id: set.id, exercise: exercise.name, set_number })
    },
    {
      name: 'update_set',
      description: "Edit one logged set's weight, reps, or notes. Use get_gym_today to see set numbers first.",
      schema: z.object({
        exercise_name: z.string(),
        set_number: z.number().int().min(1),
        date: z.string().optional().describe('YYYY-MM-DD; defaults to today'),
        weight: z.number().optional(),
        reps: z.number().int().optional(),
        notes: z.string().optional(),
      }),
    },
  )

  const deleteSet = tool(
    async ({ exercise_name, set_number, date }) => {
      const exercise = await findExercise(exercise_name)
      if (!exercise) return JSON.stringify({ ok: false, message: `No exercise matching "${exercise_name}".` })
      const day = date || localDateStr()
      const workout = await db.prepare('SELECT id FROM gym_workouts WHERE date = ? ORDER BY created_at DESC LIMIT 1').get(day)
      if (!workout) return JSON.stringify({ ok: false, message: `No workout on ${day}.` })
      const set = await db
        .prepare('SELECT id FROM gym_sets WHERE workout_id = ? AND exercise_id = ? AND set_number = ?')
        .get(workout.id, exercise.id, set_number)
      if (!set) return JSON.stringify({ ok: false, message: `No set ${set_number} for "${exercise.name}" on ${day}.` })
      await db.prepare('DELETE FROM gym_sets WHERE id = ?').run(set.id)
      record(`🗑️ Removed ${exercise.name} set ${set_number}`)
      return JSON.stringify({ ok: true, exercise: exercise.name, set_number })
    },
    {
      name: 'delete_set',
      description: 'Delete one logged set by exercise name and set number. Prefer clear_exercise_sets to wipe all sets for an exercise.',
      schema: z.object({
        exercise_name: z.string(),
        set_number: z.number().int().min(1),
        date: z.string().optional().describe('YYYY-MM-DD; defaults to today'),
      }),
    },
  )

  // -------------------------------------------------------------------------
  // update_workout — rename, notes, mark complete/incomplete
  // -------------------------------------------------------------------------
  const updateWorkout = tool(
    async ({ workout_id, date, title, notes, completed }) => {
      let workout
      if (workout_id) {
        workout = await db.prepare('SELECT id, title FROM gym_workouts WHERE id = ?').get(workout_id)
      } else {
        const day = date || localDateStr()
        workout = await db.prepare('SELECT id, title FROM gym_workouts WHERE date = ? ORDER BY created_at DESC LIMIT 1').get(day)
      }
      if (!workout) return JSON.stringify({ ok: false, message: 'No matching workout found.' })
      const sets = []
      const p = { id: workout.id, ts: now() }
      if (title !== undefined) { sets.push('title = @title'); p.title = title }
      if (notes !== undefined) { sets.push('notes = @notes'); p.notes = notes }
      if (completed !== undefined) { sets.push('completed = @completed'); p.completed = completed ? 1 : 0 }
      if (!sets.length) return JSON.stringify({ ok: false, message: 'Nothing to update.' })
      await db.prepare(`UPDATE gym_workouts SET ${sets.join(', ')}, updated_at = @ts WHERE id = @id`).run(p)
      record(`✏️ Updated workout "${title || workout.title}"`)
      return JSON.stringify({ ok: true, workout_id: workout.id })
    },
    {
      name: 'update_workout',
      description: 'Edit a workout session: rename, change notes, or mark completed. Target by workout_id (from list_workouts) or date (most recent that day).',
      schema: z.object({
        workout_id: z.string().optional(),
        date: z.string().optional().describe('YYYY-MM-DD when no workout_id'),
        title: z.string().optional(),
        notes: z.string().optional(),
        completed: z.boolean().optional(),
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
  // set_exercise_goal / update_exercise — edit the library standard (targets)
  // -------------------------------------------------------------------------
  async function patchExerciseStandard(exercise, fields) {
    const sets = []
    const p = { id: exercise.id, ts: now() }
    const apply = (col, val) => { sets.push(`${col} = @${col}`); p[col] = val }
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
    if (!sets.length) return { ok: false, message: 'Nothing to update.' }
    await db.prepare(`UPDATE gym_exercises SET ${sets.join(', ')}, updated_at = @ts WHERE id = @id`).run(p)
    return { ok: true, id: exercise.id, name: fields.new_name || exercise.name }
  }

  const setExerciseGoal = tool(
    async ({ exercise_name, goal, default_sets, rep_low, rep_high, target_weight, increment, notes }) => {
      const exercise = await findExercise(exercise_name)
      if (!exercise) return JSON.stringify({ ok: false, message: `No exercise matching "${exercise_name}".` })
      const fields = { increment, notes }
      if (goal) {
        const g = parseExerciseGoal(goal)
        if (!g) return JSON.stringify({ ok: false, message: `Couldn't parse goal "${goal}". Try "5x10@20kg" or "4 sets of 8".` })
        Object.assign(fields, g)
      }
      if (default_sets !== undefined) fields.default_sets = default_sets
      if (rep_low !== undefined) fields.rep_low = rep_low
      if (rep_high !== undefined) fields.rep_high = rep_high
      if (target_weight !== undefined) fields.target_weight = target_weight
      const result = await patchExerciseStandard(exercise, fields)
      if (!result.ok) return JSON.stringify(result)
      const label = goal || `${fields.default_sets ?? ''}×${fields.rep_low ?? ''}${fields.target_weight != null ? `@${fields.target_weight}` : ''}`
      record(`🎯 Set goal for "${result.name}"${label ? ` — ${label}` : ''}`)
      return JSON.stringify({ ok: true, id: result.id, exercise: result.name, ...fields })
    },
    {
      name: 'set_exercise_goal',
      description:
        'Update an exercise\'s TARGET / STANDARD in the library (NOT today\'s logged sets). Use when the user says "goal", "target", "standard", or "I want to work up to". Pass goal shorthand like "5x10@20kg", "3x6 at 30kg", or "4 sets of 8". This changes default_sets, rep range, and target_weight — it does NOT log a workout.',
      schema: z.object({
        exercise_name: z.string(),
        goal: z.string().optional().describe('shorthand: "5x10@20kg", "5 sets of 5", etc.'),
        default_sets: z.number().int().optional(),
        rep_low: z.number().int().optional(),
        rep_high: z.number().int().optional(),
        target_weight: z.number().optional().describe('working weight goal in kg/lb'),
        increment: z.number().optional(),
        notes: z.string().optional(),
      }),
    },
  )

  const updateExercise = tool(
    async ({ exercise_name, new_name, category, unit, muscle_group, rep_low, rep_high, default_sets, target_weight, goal, increment, notes }) => {
      const exercise = await findExercise(exercise_name)
      if (!exercise) return JSON.stringify({ ok: false, message: `No exercise matching "${exercise_name}".` })
      const fields = { new_name, category, unit, muscle_group, rep_low, rep_high, default_sets, target_weight, increment, notes }
      if (goal) Object.assign(fields, parseExerciseGoal(goal) || {})
      const result = await patchExerciseStandard(exercise, fields)
      if (!result.ok) return JSON.stringify(result)
      record(`✏️ Updated exercise "${result.name}"`)
      return JSON.stringify({ ok: true, id: result.id })
    },
    {
      name: 'update_exercise',
      description: "Edit an exercise's library standard: rename, rep range, default sets, target weight, increment, unit, muscle group, category, notes. For goal changes prefer set_exercise_goal.",
      schema: z.object({
        exercise_name: z.string().describe('current name fragment'),
        goal: z.string().optional().describe('shorthand goal like "5x10@20kg"'),
        new_name: z.string().optional(),
        category: z.enum(['strength', 'rehab', 'mobility', 'conditioning']).optional(),
        unit: z.enum(['kg', 'lb', 'bodyweight', 'band', 'time']).optional(),
        muscle_group: z.string().optional(),
        rep_low: z.number().int().optional(),
        rep_high: z.number().int().optional(),
        default_sets: z.number().int().optional(),
        target_weight: z.number().optional(),
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
    resolveExerciseTool,
    logExercise,
    createExercise,
    logSet,
    logSets,
    updateSet,
    deleteSet,
    getGymToday,
    listRoutines,
    createRoutine,
    addExerciseToRoutine,
    startWorkout,
    finishWorkout,
    updateWorkout,
    listWorkouts,
    deleteWorkout,
    clearExerciseSetsTool,
    deleteExercise,
    deleteRoutine,
    updateExercise,
    setExerciseGoal,
    updateRoutine,
    removeExerciseFromRoutine,
  ]
}
