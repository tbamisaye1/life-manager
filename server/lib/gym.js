import { db } from '../db/index.js'

// Pull the most recent prior performance of an exercise (optionally before a
// given workout, so an in-progress session compares against the LAST one).
export function lastPerformance(exerciseId, beforeWorkoutId = null) {
  const params = { ex: exerciseId }
  let exclude = ''
  if (beforeWorkoutId) { exclude = 'AND w.id != @wid'; params.wid = beforeWorkoutId }
  const lastWorkout = db.prepare(`
    SELECT w.id, w.date FROM gym_workouts w
    JOIN gym_sets s ON s.workout_id = w.id
    WHERE s.exercise_id = @ex ${exclude}
    ORDER BY w.date DESC, w.created_at DESC LIMIT 1`).get(params)
  if (!lastWorkout) return null
  const sets = db.prepare('SELECT * FROM gym_sets WHERE workout_id = ? AND exercise_id = ? ORDER BY set_number')
    .all(lastWorkout.id, exerciseId)
  return { workoutId: lastWorkout.id, date: lastWorkout.date, sets }
}

/**
 * Suggest what to do THIS session for an exercise, from last time's numbers.
 * Heuristic: hit the top of your rep range across all sets -> go up a weight
 * step; landed inside the range -> add a rep; missed the bottom -> ease off.
 * Rehab/mobility exercises hold weight and just nudge reps (gentler).
 */
export function suggestForExercise(exercise, beforeWorkoutId = null) {
  const last = lastPerformance(exercise.id, beforeWorkoutId)
  const sets = exercise.default_sets || 3
  const weighted = !['bodyweight', 'time'].includes(exercise.unit)
  const gentle = ['rehab', 'mobility'].includes(exercise.category)

  if (!last || last.sets.length === 0) {
    return { weight: null, reps: exercise.rep_low, sets, direction: 'new',
      rationale: 'First time — pick a weight you can control for the full range.', last: null }
  }

  const topWeight = Math.max(...last.sets.map((s) => s.weight || 0))
  const topSets = last.sets.filter((s) => (s.weight || 0) === topWeight)
  const minReps = Math.min(...topSets.map((s) => s.reps || 0))
  const lastSummary = { date: last.date, weight: topWeight, sets: last.sets.length, reps: minReps }

  if (minReps >= exercise.rep_high) {
    if (weighted && !gentle) {
      return { weight: +(topWeight + exercise.increment).toFixed(2), reps: exercise.rep_low, sets, direction: 'up',
        rationale: `Last time you hit ${minReps} reps — top of your range. Go up ${exercise.increment}${exercise.unit}.`, last: lastSummary }
    }
    return { weight: weighted ? topWeight : null, reps: exercise.rep_high + 1, sets, direction: 'up',
      rationale: `You maxed the range last time — add a rep.`, last: lastSummary }
  }
  if (minReps >= exercise.rep_low) {
    return { weight: weighted ? topWeight : null, reps: Math.min(minReps + 1, exercise.rep_high), sets, direction: 'hold',
      rationale: `Same weight, aim for ${Math.min(minReps + 1, exercise.rep_high)} reps to keep progressing.`, last: lastSummary }
  }
  // Missed the bottom of the range.
  if (weighted && !gentle) {
    return { weight: +Math.max(0, topWeight - exercise.increment).toFixed(2), reps: exercise.rep_low, sets, direction: 'down',
      rationale: `Last time was a grind (${minReps} reps). Drop ${exercise.increment}${exercise.unit} and rebuild clean reps.`, last: lastSummary }
  }
  return { weight: weighted ? topWeight : null, reps: exercise.rep_low, sets, direction: 'hold',
    rationale: `Hold here and groove the movement before progressing.`, last: lastSummary }
}
