/**
 * Register full gym CRUD tools on the Life Manager MCP server.
 * Claude (and other MCP hosts) use these to manage exercises, routines,
 * workouts, sets, notes, goals, and schedule.
 */
import { z } from 'zod'
import * as gym from '../lib/gymOps.js'

function jsonResult(data) {
  return {
    content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }],
  }
}

const categoryEnum = z.enum(['strength', 'rehab', 'mobility', 'conditioning'])
const unitEnum = z.enum(['kg', 'lb', 'bodyweight', 'band', 'time'])

const GROUP_SCHEMA = z.object({
  notation: z.string().optional().describe('e.g. "3x10@12.5kg"'),
  sets: z.number().int().optional(),
  reps: z.number().int().optional(),
  weight: z.number().optional(),
})

export function registerGymTools(server) {
  // ── Library ──────────────────────────────────────────────────────────────

  server.registerTool(
    'list_exercises',
    {
      description: 'List gym exercises (library). Optional category / search query. Set include_archived to see archived.',
      inputSchema: {
        category: categoryEnum.optional(),
        query: z.string().optional().describe('name/muscle fragment'),
        include_archived: z.boolean().optional(),
      },
    },
    async (args) => jsonResult({ ok: true, exercises: await gym.listExercises(args) }),
  )

  server.registerTool(
    'get_exercise',
    {
      description: 'Get one exercise by name fragment or id (full library fields: goals, notes, unit, etc.).',
      inputSchema: { name_or_id: z.string() },
    },
    async ({ name_or_id }) => {
      const exercise = await gym.getExercise(name_or_id)
      return jsonResult(exercise ? { ok: true, exercise } : { ok: false, message: 'Exercise not found.' })
    },
  )

  server.registerTool(
    'resolve_exercise',
    {
      description: 'Check which library exercise matches a spoken/typed name BEFORE logging. Use when spelling might differ.',
      inputSchema: { name: z.string() },
    },
    async ({ name }) => {
      const { exercise, candidates } = await gym.resolveExercise(name)
      return jsonResult({
        best_match: exercise?.name ?? null,
        candidates: candidates.map((c) => c.name),
        will_create_new: !exercise,
      })
    },
  )

  server.registerTool(
    'create_exercise',
    {
      description: 'Create a new exercise in the library (name, category, unit, rep range, default sets, target weight, notes).',
      inputSchema: {
        name: z.string(),
        category: categoryEnum.optional(),
        unit: unitEnum.optional(),
        muscle_group: z.string().optional(),
        rep_low: z.number().int().optional(),
        rep_high: z.number().int().optional(),
        default_sets: z.number().int().optional(),
        target_weight: z.number().optional(),
        increment: z.number().optional(),
        notes: z.string().optional(),
      },
    },
    async (args) => jsonResult(await gym.createExercise(args)),
  )

  server.registerTool(
    'update_exercise',
    {
      description:
        "Edit an exercise's library fields: rename, category, unit, muscle group, rep range, default sets, target weight, increment, notes. Prefer set_exercise_goal for goal shorthand.",
      inputSchema: {
        exercise_name: z.string(),
        new_name: z.string().optional(),
        goal: z.string().optional().describe('shorthand like "5x10@20kg"'),
        category: categoryEnum.optional(),
        unit: unitEnum.optional(),
        muscle_group: z.string().optional(),
        rep_low: z.number().int().optional(),
        rep_high: z.number().int().optional(),
        default_sets: z.number().int().optional(),
        target_weight: z.number().optional(),
        increment: z.number().optional(),
        notes: z.string().optional(),
      },
    },
    async (args) => jsonResult(await gym.updateExercise(args)),
  )

  server.registerTool(
    'set_exercise_goal',
    {
      description:
        'Update TARGET / STANDARD for an exercise (NOT today\'s logged sets). Use when user says goal/target/standard. Pass goal like "5x10@20kg" or "4 sets of 8".',
      inputSchema: {
        exercise_name: z.string(),
        goal: z.string().optional(),
        default_sets: z.number().int().optional(),
        rep_low: z.number().int().optional(),
        rep_high: z.number().int().optional(),
        target_weight: z.number().optional(),
        increment: z.number().optional(),
        notes: z.string().optional(),
      },
    },
    async (args) => jsonResult(await gym.setExerciseGoal(args)),
  )

  server.registerTool(
    'append_exercise_notes',
    {
      description: 'Append (or replace) notes on an exercise definition — cues, form tips, injuries.',
      inputSchema: {
        exercise_name: z.string(),
        notes: z.string(),
        replace: z.boolean().optional().describe('true = overwrite instead of append'),
      },
    },
    async (args) => jsonResult(await gym.appendExerciseNotes(args)),
  )

  server.registerTool(
    'archive_exercise',
    {
      description: 'Soft-hide an exercise from the active library (or unarchive). Prefer this over delete_exercise.',
      inputSchema: {
        exercise_name: z.string(),
        archived: z.boolean().optional().describe('default true; false to restore'),
      },
    },
    async ({ exercise_name, archived = true }) => jsonResult(await gym.archiveExercise(exercise_name, archived)),
  )

  server.registerTool(
    'delete_exercise',
    {
      description:
        'Permanently delete an exercise and all its logged sets everywhere. Only when user wants it gone entirely — NOT for cleaning today\'s log (use clear_exercise_sets).',
      inputSchema: { exercise_name: z.string() },
    },
    async ({ exercise_name }) => jsonResult(await gym.deleteExercise(exercise_name)),
  )

  server.registerTool(
    'get_exercise_history',
    {
      description: 'Progress history for one exercise: sessions over time + next-session suggestion.',
      inputSchema: { exercise_name: z.string() },
    },
    async ({ exercise_name }) => jsonResult(await gym.getExerciseHistory(exercise_name)),
  )

  // ── Logging ──────────────────────────────────────────────────────────────

  server.registerTool(
    'log_exercise',
    {
      description:
        'PRIMARY gym logging tool. Log sets with shorthand in notation (e.g. "5x10@20kg"). For different weights use groups: [{notation:"3x10@12.5"},{notation:"2x10@20"}]. replace:true clears existing sets for that exercise first. Pass the full exercise name the user said.',
      inputSchema: {
        exercise_name: z.string(),
        notation: z.string().optional(),
        sets: z.number().int().optional(),
        reps: z.number().int().optional(),
        weight: z.number().optional(),
        groups: z.array(GROUP_SCHEMA).optional(),
        replace: z.boolean().optional(),
        date: z.string().optional().describe('YYYY-MM-DD; defaults today'),
        notes: z.string().optional(),
        rpe: z.number().optional(),
        done: z.boolean().optional(),
      },
    },
    async (args) => jsonResult(await gym.logExercise(args)),
  )

  server.registerTool(
    'log_set',
    {
      description: 'Log a SINGLE set. If user gives a set count, prefer log_exercise / log_sets.',
      inputSchema: {
        exercise_name: z.string(),
        weight: z.number().optional(),
        reps: z.number().int().optional(),
        rpe: z.number().optional(),
        date: z.string().optional(),
        notes: z.string().optional(),
        done: z.boolean().optional(),
      },
    },
    async (args) => jsonResult(await gym.logSet(args)),
  )

  server.registerTool(
    'log_sets',
    {
      description: 'Log many identical sets in one call. Prefer log_exercise for shorthand + multi-weight groups.',
      inputSchema: {
        exercise_name: z.string(),
        notation: z.string().optional(),
        sets: z.number().int().min(1).max(20).optional(),
        reps: z.number().int().optional(),
        weight: z.number().optional(),
        rpe: z.number().optional(),
        date: z.string().optional(),
        notes: z.string().optional(),
        replace: z.boolean().optional(),
      },
    },
    async (args) => jsonResult(await gym.logSets(args)),
  )

  server.registerTool(
    'update_set',
    {
      description: "Edit one logged set's weight, reps, RPE, notes, or done flag. Call get_gym_today first for set numbers.",
      inputSchema: {
        exercise_name: z.string(),
        set_number: z.number().int().min(1).optional(),
        set_id: z.string().optional(),
        workout_id: z.string().optional(),
        date: z.string().optional(),
        weight: z.number().optional(),
        reps: z.number().int().optional(),
        rpe: z.number().optional(),
        notes: z.string().optional(),
        append_notes: z.string().optional(),
        done: z.boolean().optional(),
      },
    },
    async (args) => jsonResult(await gym.updateSet(args)),
  )

  server.registerTool(
    'delete_set',
    {
      description: 'Delete one logged set (by set_number or set_id). Remaining sets are re-numbered.',
      inputSchema: {
        exercise_name: z.string(),
        set_number: z.number().int().min(1).optional(),
        set_id: z.string().optional(),
        workout_id: z.string().optional(),
        date: z.string().optional(),
      },
    },
    async (args) => jsonResult(await gym.deleteSet(args)),
  )

  server.registerTool(
    'clear_exercise_sets',
    {
      description:
        "Remove all logged sets for one exercise from a workout (default today). Does NOT delete the exercise definition.",
      inputSchema: {
        exercise_name: z.string(),
        date: z.string().optional(),
        workout_id: z.string().optional(),
      },
    },
    async (args) => jsonResult(await gym.clearExerciseSetsOp(args)),
  )

  // ── Workouts / today ─────────────────────────────────────────────────────

  server.registerTool(
    'get_gym_today',
    {
      description: "Today's scheduled routines + workouts with per-set detail. Call before editing/removing sets.",
      inputSchema: {},
    },
    async () => jsonResult(await gym.getGymToday()),
  )

  server.registerTool(
    'get_gym_schedule',
    {
      description: 'Weekly gym schedule: which routines are assigned to which weekday (0=Sun…6=Sat).',
      inputSchema: {},
    },
    async () => jsonResult(await gym.getGymSchedule()),
  )

  server.registerTool(
    'list_workouts',
    {
      description: 'List workouts (most recent first). Optionally bound by date range.',
      inputSchema: {
        from: z.string().optional(),
        to: z.string().optional(),
        limit: z.number().int().optional(),
      },
    },
    async (args) => jsonResult(await gym.listWorkouts(args)),
  )

  server.registerTool(
    'get_workout',
    {
      description: 'Full workout detail with every exercise and set. Target by workout_id or date (most recent that day).',
      inputSchema: {
        workout_id: z.string().optional(),
        date: z.string().optional(),
      },
    },
    async (args) => jsonResult(await gym.getWorkout(args)),
  )

  server.registerTool(
    'start_workout',
    {
      description: 'Create a new workout session for a date (default today). Optionally link to a routine and set notes.',
      inputSchema: {
        routine_name: z.string().optional(),
        date: z.string().optional(),
        title: z.string().optional(),
        notes: z.string().optional(),
      },
    },
    async (args) => jsonResult(await gym.startWorkout(args)),
  )

  server.registerTool(
    'finish_workout',
    {
      description: 'Mark a workout completed (most recent incomplete, or by date / workout_id).',
      inputSchema: {
        date: z.string().optional(),
        workout_id: z.string().optional(),
      },
    },
    async (args) => jsonResult(await gym.finishWorkout(args)),
  )

  server.registerTool(
    'update_workout',
    {
      description: 'Edit workout title, notes (or append_notes), completed flag, or linked routine.',
      inputSchema: {
        workout_id: z.string().optional(),
        date: z.string().optional(),
        title: z.string().optional(),
        notes: z.string().optional(),
        append_notes: z.string().optional(),
        completed: z.boolean().optional(),
        routine_name: z.string().nullable().optional(),
      },
    },
    async (args) => jsonResult(await gym.updateWorkout(args)),
  )

  server.registerTool(
    'delete_workout',
    {
      description: 'Delete workout(s) and their sets. Target ONE of: workout_id, date, or all:true.',
      inputSchema: {
        workout_id: z.string().optional(),
        date: z.string().optional(),
        all: z.boolean().optional(),
      },
    },
    async (args) => jsonResult(await gym.deleteWorkout(args)),
  )

  // ── Routines ─────────────────────────────────────────────────────────────

  server.registerTool(
    'list_routines',
    {
      description: 'List all routines with their exercises (target sets, order).',
      inputSchema: {},
    },
    async () => jsonResult(await gym.listRoutines()),
  )

  server.registerTool(
    'get_routine',
    {
      description: 'Get one routine by name fragment with full exercise list.',
      inputSchema: { routine_name: z.string() },
    },
    async ({ routine_name }) => jsonResult(await gym.getRoutine(routine_name)),
  )

  server.registerTool(
    'create_routine',
    {
      description: 'Create a workout routine / day template. weekday: 0=Sun…6=Sat, omit for unscheduled.',
      inputSchema: {
        name: z.string(),
        weekday: z.number().int().min(0).max(6).nullable().optional(),
        emoji: z.string().optional(),
        color: z.string().optional(),
        notes: z.string().optional(),
      },
    },
    async (args) => jsonResult(await gym.createRoutine(args)),
  )

  server.registerTool(
    'update_routine',
    {
      description: 'Edit a routine: rename, reschedule weekday, emoji, colour, notes, append_notes, sort_order.',
      inputSchema: {
        routine_name: z.string(),
        new_name: z.string().optional(),
        weekday: z.number().int().min(0).max(6).nullable().optional(),
        emoji: z.string().optional(),
        color: z.string().optional(),
        notes: z.string().optional(),
        append_notes: z.string().optional(),
        sort_order: z.number().int().optional(),
      },
    },
    async (args) => jsonResult(await gym.updateRoutine(args)),
  )

  server.registerTool(
    'delete_routine',
    {
      description: 'Delete a routine (does not delete the exercises themselves).',
      inputSchema: { routine_name: z.string() },
    },
    async ({ routine_name }) => jsonResult(await gym.deleteRoutine(routine_name)),
  )

  server.registerTool(
    'add_exercise_to_routine',
    {
      description: 'Add an exercise to a routine. Optionally create the exercise if missing. Sets target_sets (default 3).',
      inputSchema: {
        routine_name: z.string(),
        exercise_name: z.string(),
        target_sets: z.number().int().optional(),
        sort_order: z.number().int().optional(),
        create_if_missing: z.boolean().optional(),
      },
    },
    async (args) => jsonResult(await gym.addExerciseToRoutine(args)),
  )

  server.registerTool(
    'remove_exercise_from_routine',
    {
      description: 'Remove an exercise from a routine without deleting the exercise.',
      inputSchema: {
        routine_name: z.string(),
        exercise_name: z.string(),
      },
    },
    async (args) => jsonResult(await gym.removeExerciseFromRoutine(args)),
  )

  server.registerTool(
    'update_routine_exercise',
    {
      description: 'Change target_sets or sort_order for an exercise inside a routine.',
      inputSchema: {
        routine_name: z.string(),
        exercise_name: z.string(),
        target_sets: z.number().int().optional(),
        sort_order: z.number().int().optional(),
      },
    },
    async (args) => jsonResult(await gym.updateRoutineExercise(args)),
  )

  server.registerTool(
    'reorder_routine_exercises',
    {
      description: 'Set the exercise order in a routine by passing exercise_names in the desired order.',
      inputSchema: {
        routine_name: z.string(),
        exercise_names: z.array(z.string()),
      },
    },
    async (args) => jsonResult(await gym.reorderRoutineExercises(args)),
  )

  server.registerTool(
    'create_routine_from_workout',
    {
      description: 'Turn a logged workout into a reusable routine template (exercises + set counts).',
      inputSchema: {
        workout_id: z.string().optional(),
        date: z.string().optional(),
        name: z.string().optional(),
        weekday: z.number().int().min(0).max(6).nullable().optional(),
        emoji: z.string().optional(),
        color: z.string().optional(),
        notes: z.string().optional(),
      },
    },
    async (args) => jsonResult(await gym.createRoutineFromWorkout(args)),
  )
}
