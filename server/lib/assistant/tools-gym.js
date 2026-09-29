/**
 * In-app assistant gym tools — thin LangChain wrappers over shared gymOps.
 * MCP tools live in server/mcp/gymTools.js and call the same ops.
 */
import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import * as gym from '../gymOps.js'

const categoryEnum = z.enum(['strength', 'rehab', 'mobility', 'conditioning'])
const unitEnum = z.enum(['kg', 'lb', 'bodyweight', 'band', 'time'])

const GROUP_SCHEMA = z.object({
  notation: z.string().optional().describe('e.g. "3x10@12.5kg", "2 sets of 6 at 26kg"'),
  sets: z.number().int().optional(),
  reps: z.number().int().optional(),
  weight: z.number().optional(),
})

function j(data) {
  return JSON.stringify(data)
}

export function buildGymTools({ record }) {
  const listExercises = tool(
    async ({ category }) => j({ ok: true, exercises: await gym.listExercises({ category }) }),
    {
      name: 'list_exercises',
      description: 'List all non-archived exercises, optionally filtered by category.',
      schema: z.object({ category: categoryEnum.optional().describe('Filter by category; omit for all') }),
    },
  )

  const createExercise = tool(
    async (args) => {
      const result = await gym.createExercise(args)
      if (result.ok) record(`🆕 Added exercise "${result.name}"`)
      return j(result)
    },
    {
      name: 'create_exercise',
      description: 'Create a new exercise definition.',
      schema: z.object({
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
      }),
    },
  )

  const resolveExerciseTool = tool(
    async ({ name }) => {
      const { exercise, candidates } = await gym.resolveExercise(name)
      return j({ best_match: exercise?.name ?? null, candidates: candidates.map((c) => c.name), will_create_new: !exercise })
    },
    {
      name: 'resolve_exercise',
      description: 'Check which library exercise matches a name BEFORE logging.',
      schema: z.object({ name: z.string() }),
    },
  )

  const logExercise = tool(
    async (args) => {
      const result = await gym.logExercise(args)
      if (result.ok) {
        if (result.auto_created_exercise) record(`🆕 Added exercise "${result.exercise}"`)
        for (const d of result.details || []) {
          const label = d.per ? `${d.sets} sets of ${d.per}` : `${d.sets} sets`
          record(`🏋️ Logged ${result.exercise} — ${label}`)
        }
      }
      return j(result)
    },
    {
      name: 'log_exercise',
      description:
        'PRIMARY gym logging tool. Log sets using gym shorthand in `notation` — e.g. "5x10@20kg". For different weights use `groups`. Set replace:true when CORRECTING. ALWAYS pass the full exercise name the user said.',
      schema: z.object({
        exercise_name: z.string().describe('Exercise name exactly as the user said it'),
        notation: z.string().optional(),
        sets: z.number().int().optional(),
        reps: z.number().int().optional(),
        weight: z.number().optional(),
        groups: z.array(GROUP_SCHEMA).optional(),
        replace: z.boolean().optional(),
        date: z.string().optional(),
        notes: z.string().optional(),
        rpe: z.number().optional(),
      }),
    },
  )

  const logSet = tool(
    async (args) => {
      const result = await gym.logSet(args)
      if (result.ok) {
        if (result.auto_created_exercise) record(`🆕 Added exercise "${result.exercise}"`)
        record(`🏋️ Logged ${result.exercise} — set ${result.set_number}`)
      }
      return j(result)
    },
    {
      name: 'log_set',
      description: "Log a SINGLE set. If the user gives a set COUNT, use log_sets / log_exercise instead.",
      schema: z.object({
        exercise_name: z.string(),
        weight: z.number().optional(),
        reps: z.number().int().optional(),
        rpe: z.number().optional(),
        date: z.string().optional(),
        notes: z.string().optional(),
      }),
    },
  )

  const logSets = tool(
    async (args) => {
      const result = await gym.logSets(args)
      if (result.ok) {
        if (result.auto_created_exercise) record(`🆕 Added exercise "${result.exercise}"`)
        if (result.cleared) record(`🗑️ Cleared ${result.cleared} existing set${result.cleared === 1 ? '' : 's'} for "${result.exercise}"`)
        record(`🏋️ Logged ${result.exercise} — ${result.sets} sets${result.per ? ` of ${result.per}` : ''}`)
      }
      return j(result)
    },
    {
      name: 'log_sets',
      description: 'Log many identical sets in one call. Prefer log_exercise for shorthand + multi-weight groups.',
      schema: z.object({
        exercise_name: z.string(),
        notation: z.string().optional(),
        sets: z.number().int().min(1).max(20).optional(),
        reps: z.number().int().optional(),
        weight: z.number().optional(),
        date: z.string().optional(),
        notes: z.string().optional(),
        replace: z.boolean().optional(),
      }),
    },
  )

  const getGymToday = tool(
    async () => j(await gym.getGymToday()),
    {
      name: 'get_gym_today',
      description: "Return today's workout with per-set detail. Call before changing or removing sets.",
      schema: z.object({}),
    },
  )

  const listRoutines = tool(
    async () => {
      const result = await gym.listRoutines()
      return j({
        ok: true,
        routines: (result.routines || []).map((r) => ({
          ...r,
          exercises: (r.exercises || []).map((e) => e.name),
        })),
      })
    },
    {
      name: 'list_routines',
      description: 'List all routines with their exercise names.',
      schema: z.object({}),
    },
  )

  const createRoutine = tool(
    async (args) => {
      const result = await gym.createRoutine(args)
      if (result.ok) record(`🏋️ Created routine "${result.name}"`)
      return j(result)
    },
    {
      name: 'create_routine',
      description: 'Create a new workout routine.',
      schema: z.object({
        name: z.string(),
        weekday: z.number().int().min(0).max(6).optional(),
        emoji: z.string().optional(),
        color: z.string().optional(),
        notes: z.string().optional(),
      }),
    },
  )

  const addExerciseToRoutine = tool(
    async (args) => {
      const result = await gym.addExerciseToRoutine(args)
      if (result.ok) record(`➕ Added "${result.exercise}" to routine "${result.routine}"`)
      return j(result)
    },
    {
      name: 'add_exercise_to_routine',
      description: 'Add an exercise to a routine (both resolved by name).',
      schema: z.object({
        routine_name: z.string(),
        exercise_name: z.string(),
        target_sets: z.number().int().optional(),
        create_if_missing: z.boolean().optional(),
      }),
    },
  )

  const startWorkout = tool(
    async (args) => {
      const result = await gym.startWorkout(args)
      if (result.ok) record(`💪 Started workout${result.title !== 'Workout' ? ` "${result.title}"` : ''}`)
      return j(result)
    },
    {
      name: 'start_workout',
      description: 'Create a new workout session for a date (defaults to today). Optionally link to a routine.',
      schema: z.object({
        routine_name: z.string().optional(),
        date: z.string().optional(),
        title: z.string().optional(),
        notes: z.string().optional(),
      }),
    },
  )

  const finishWorkout = tool(
    async (args) => {
      const result = await gym.finishWorkout(args)
      if (result.ok) record(`✅ Finished workout${result.title ? ` "${result.title}"` : ''}`)
      return j(result)
    },
    {
      name: 'finish_workout',
      description: 'Mark the most recent incomplete workout as completed.',
      schema: z.object({ date: z.string().optional(), workout_id: z.string().optional() }),
    },
  )

  const updateSet = tool(
    async (args) => {
      const result = await gym.updateSet(args)
      if (result.ok) record(`✏️ Updated ${result.exercise} set ${result.set_number}`)
      return j(result)
    },
    {
      name: 'update_set',
      description: "Edit one logged set's weight, reps, notes, RPE, or done. Use get_gym_today first.",
      schema: z.object({
        exercise_name: z.string(),
        set_number: z.number().int().min(1).optional(),
        set_id: z.string().optional(),
        date: z.string().optional(),
        weight: z.number().optional(),
        reps: z.number().int().optional(),
        rpe: z.number().optional(),
        notes: z.string().optional(),
        done: z.boolean().optional(),
      }),
    },
  )

  const deleteSet = tool(
    async (args) => {
      const result = await gym.deleteSet(args)
      if (result.ok) record(`🗑️ Removed ${result.exercise} set ${result.set_number}`)
      return j(result)
    },
    {
      name: 'delete_set',
      description: 'Delete one logged set by exercise name and set number.',
      schema: z.object({
        exercise_name: z.string(),
        set_number: z.number().int().min(1).optional(),
        set_id: z.string().optional(),
        date: z.string().optional(),
      }),
    },
  )

  const updateWorkout = tool(
    async (args) => {
      const result = await gym.updateWorkout(args)
      if (result.ok) record(`✏️ Updated workout`)
      return j(result)
    },
    {
      name: 'update_workout',
      description: 'Edit a workout session: rename, change notes, or mark completed.',
      schema: z.object({
        workout_id: z.string().optional(),
        date: z.string().optional(),
        title: z.string().optional(),
        notes: z.string().optional(),
        append_notes: z.string().optional(),
        completed: z.boolean().optional(),
      }),
    },
  )

  const listWorkouts = tool(
    async (args) => j(await gym.listWorkouts(args)),
    {
      name: 'list_workouts',
      description: 'List workouts (most recent first) with their ids — use before deleting.',
      schema: z.object({
        from: z.string().optional(),
        to: z.string().optional(),
        limit: z.number().int().optional(),
      }),
    },
  )

  const clearExerciseSetsTool = tool(
    async (args) => {
      const result = await gym.clearExerciseSetsOp(args)
      if (result.ok) {
        if (result.cleared) record(`🗑️ Cleared ${result.cleared} set${result.cleared === 1 ? '' : 's'} for "${result.exercise}"`)
        else record(`ℹ️ No sets to clear for "${result.exercise}"`)
      }
      return j(result)
    },
    {
      name: 'clear_exercise_sets',
      description: "Remove all logged sets for one exercise from a workout. Prefer over delete_exercise when cleaning a log.",
      schema: z.object({ exercise_name: z.string(), date: z.string().optional() }),
    },
  )

  const deleteWorkout = tool(
    async (args) => {
      const result = await gym.deleteWorkout(args)
      if (result.ok) record(`🗑️ Deleted ${result.deleted} workout${result.deleted === 1 ? '' : 's'}`)
      return j(result)
    },
    {
      name: 'delete_workout',
      description: 'Delete workouts (and their logged sets). Target ONE of: workout_id, date, or all:true.',
      schema: z.object({
        workout_id: z.string().optional(),
        date: z.string().optional(),
        all: z.boolean().optional(),
      }),
    },
  )

  const deleteExercise = tool(
    async ({ exercise_name }) => {
      const result = await gym.deleteExercise(exercise_name)
      if (result.ok) record(`🗑️ Deleted exercise "${result.name}"`)
      return j(result)
    },
    {
      name: 'delete_exercise',
      description: 'Delete an exercise from the library (and all its logged sets). Prefer clear_exercise_sets for workout cleanup.',
      schema: z.object({ exercise_name: z.string() }),
    },
  )

  const setExerciseGoal = tool(
    async (args) => {
      const result = await gym.setExerciseGoal(args)
      if (result.ok) record(`🎯 Set goal for "${result.name}"`)
      return j(result)
    },
    {
      name: 'set_exercise_goal',
      description: 'Update an exercise TARGET / STANDARD. Pass goal shorthand like "5x10@20kg". Does NOT log a workout.',
      schema: z.object({
        exercise_name: z.string(),
        goal: z.string().optional(),
        default_sets: z.number().int().optional(),
        rep_low: z.number().int().optional(),
        rep_high: z.number().int().optional(),
        target_weight: z.number().optional(),
        increment: z.number().optional(),
        notes: z.string().optional(),
      }),
    },
  )

  const updateExercise = tool(
    async (args) => {
      const result = await gym.updateExercise(args)
      if (result.ok) record(`✏️ Updated exercise "${result.name}"`)
      return j(result)
    },
    {
      name: 'update_exercise',
      description: "Edit an exercise's library standard. For goal changes prefer set_exercise_goal.",
      schema: z.object({
        exercise_name: z.string(),
        goal: z.string().optional(),
        new_name: z.string().optional(),
        category: categoryEnum.optional(),
        unit: unitEnum.optional(),
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

  const updateRoutine = tool(
    async (args) => {
      const result = await gym.updateRoutine(args)
      if (result.ok) record(`✏️ Updated routine "${result.name}"`)
      return j(result)
    },
    {
      name: 'update_routine',
      description: 'Edit a routine: rename, weekday, emoji, colour, notes.',
      schema: z.object({
        routine_name: z.string(),
        new_name: z.string().optional(),
        weekday: z.number().int().min(0).max(6).nullable().optional(),
        emoji: z.string().optional(),
        color: z.string().optional(),
        notes: z.string().optional(),
        append_notes: z.string().optional(),
      }),
    },
  )

  const removeExerciseFromRoutine = tool(
    async (args) => {
      const result = await gym.removeExerciseFromRoutine(args)
      if (result.ok) record(`➖ Removed "${result.exercise}" from "${result.routine}"`)
      return j(result)
    },
    {
      name: 'remove_exercise_from_routine',
      description: 'Remove an exercise from a routine without deleting the exercise.',
      schema: z.object({ routine_name: z.string(), exercise_name: z.string() }),
    },
  )

  const deleteRoutine = tool(
    async ({ routine_name }) => {
      const result = await gym.deleteRoutine(routine_name)
      if (result.ok) record(`🗑️ Deleted routine "${result.name}"`)
      return j(result)
    },
    {
      name: 'delete_routine',
      description: 'Delete a routine. Does not delete the exercises themselves.',
      schema: z.object({ routine_name: z.string() }),
    },
  )

  const updateRoutineExercise = tool(
    async (args) => {
      const result = await gym.updateRoutineExercise(args)
      if (result.ok) record(`✏️ Updated "${result.exercise}" in "${result.routine}"`)
      return j(result)
    },
    {
      name: 'update_routine_exercise',
      description: 'Change target_sets or sort_order for an exercise inside a routine.',
      schema: z.object({
        routine_name: z.string(),
        exercise_name: z.string(),
        target_sets: z.number().int().optional(),
        sort_order: z.number().int().optional(),
      }),
    },
  )

  const getExerciseHistory = tool(
    async ({ exercise_name }) => j(await gym.getExerciseHistory(exercise_name)),
    {
      name: 'get_exercise_history',
      description: 'Progress history + next-session suggestion for one exercise.',
      schema: z.object({ exercise_name: z.string() }),
    },
  )

  const appendExerciseNotes = tool(
    async (args) => {
      const result = await gym.appendExerciseNotes(args)
      if (result.ok) record(`📝 Notes on "${result.name}"`)
      return j(result)
    },
    {
      name: 'append_exercise_notes',
      description: 'Append or replace notes on an exercise definition.',
      schema: z.object({
        exercise_name: z.string(),
        notes: z.string(),
        replace: z.boolean().optional(),
      }),
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
    updateRoutineExercise,
    getExerciseHistory,
    appendExerciseNotes,
  ]
}
