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
  // log_set  (the key tool)
  // -------------------------------------------------------------------------
  const logSet = tool(
    async ({ exercise_name, weight, reps, date }) => {
      const day = date || localDateStr()

      // 1. Resolve exercise by name ILIKE
      let exercise = await db
        .prepare('SELECT id, name, unit FROM gym_exercises WHERE name ILIKE ? AND archived = 0 LIMIT 1')
        .get(`%${exercise_name}%`)

      let autoCreated = false
      if (!exercise) {
        const ts = now()
        const exId = newId()
        await db
          .prepare(
            `INSERT INTO gym_exercises
               (id, name, category, unit, muscle_group, rep_low, rep_high, default_sets, increment, notes, archived, created_at, updated_at)
             VALUES
               (@id, @name, 'strength', 'kg', NULL, 8, 12, 3, 2.5, NULL, 0, @ts, @ts)`,
          )
          .run({ id: exId, name: exercise_name, ts })
        record(`🆕 Added exercise "${exercise_name}"`)
        exercise = { id: exId, name: exercise_name, unit: 'kg' }
        autoCreated = true
      }

      // 2. Find or create workout for the date
      let workout = await db
        .prepare('SELECT id FROM gym_workouts WHERE date = ? ORDER BY created_at DESC LIMIT 1')
        .get(day)

      if (!workout) {
        const ts = now()
        const wId = newId()
        await db
          .prepare(
            `INSERT INTO gym_workouts (id, date, routine_id, title, notes, completed, created_at, updated_at)
             VALUES (@id, @date, NULL, 'Workout', '', 0, @ts, @ts)`,
          )
          .run({ id: wId, date: day, ts })
        workout = { id: wId }
      }

      // 3. Determine next set_number
      const maxRow = await db
        .prepare(
          'SELECT MAX(set_number) AS max_set FROM gym_sets WHERE workout_id = ? AND exercise_id = ?',
        )
        .get(workout.id, exercise.id)
      const setNumber = Number(maxRow?.max_set ?? 0) + 1

      // 4. Insert the set
      const setId = newId()
      const setTs = now()
      await db
        .prepare(
          `INSERT INTO gym_sets (id, workout_id, exercise_id, set_number, weight, reps, rpe, done, created_at)
           VALUES (@id, @workout_id, @exercise_id, @set_number, @weight, @reps, NULL, 1, @ts)`,
        )
        .run({
          id: setId,
          workout_id: workout.id,
          exercise_id: exercise.id,
          set_number: setNumber,
          weight: weight ?? null,
          reps: reps ?? null,
          ts: setTs,
        })

      const label =
        weight != null && reps != null
          ? `${weight}${exercise.unit} × ${reps}`
          : weight != null
            ? `${weight}${exercise.unit}`
            : reps != null
              ? `${reps} reps`
              : 'set'
      record(`🏋️ Logged ${exercise.name} — ${label}`)

      return JSON.stringify({
        ok: true,
        workout_id: workout.id,
        exercise: exercise.name,
        set_number: setNumber,
        auto_created_exercise: autoCreated,
      })
    },
    {
      name: 'log_set',
      description:
        "Log a single set for an exercise. Resolves the exercise by name (creates it if missing), finds or creates today's workout, and appends the set.",
      schema: z.object({
        exercise_name: z.string().describe('Full or partial exercise name'),
        weight: z.number().optional().describe('Weight used (unit matches exercise)'),
        reps: z.number().int().optional(),
        date: z.string().optional().describe('YYYY-MM-DD; defaults to today'),
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

      return JSON.stringify({ ok: true, date: today, weekday: dayOfWeek, scheduled_routines: scheduledRoutines, workouts })
    },
    {
      name: 'get_gym_today',
      description: "Return today's date, routines scheduled for today's weekday, and any workouts already logged today.",
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

  return [
    listExercises,
    createExercise,
    logSet,
    getGymToday,
    listRoutines,
    createRoutine,
    addExerciseToRoutine,
    startWorkout,
    finishWorkout,
  ]
}
