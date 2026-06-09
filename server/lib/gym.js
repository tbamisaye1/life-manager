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
export function suggestForExercise(exercise, beforeWorkoutId = null, targetSets = null) {
  const last = lastPerformance(exercise.id, beforeWorkoutId)
  const sets = targetSets || exercise.default_sets || 3
  // band/bodyweight/time exercises aren't loaded by weight — progress on reps.
  const weighted = !['bodyweight', 'time', 'band'].includes(exercise.unit)
  const gentle = ['rehab', 'mobility'].includes(exercise.category)
  const repNoun = exercise.unit === 'time' ? 'sec' : 'reps'

  if (!last || last.sets.length === 0) {
    return { weight: null, reps: exercise.rep_low, sets, direction: 'new',
      rationale: `First time — pick something you can control for the full ${exercise.rep_low}–${exercise.rep_high} ${repNoun}.`, last: null }
  }

  // Anchor to the WORKING weight = the most common weight across the sets, so a
  // single heavier outlier (or a typo) doesn't skew the progression signal.
  const counts = {}
  for (const s of last.sets) { const w = s.weight || 0; counts[w] = (counts[w] || 0) + 1 }
  const workWeight = Number(Object.keys(counts).sort((a, b) => counts[b] - counts[a] || Number(b) - Number(a))[0])
  const workSets = last.sets.filter((s) => (s.weight || 0) === workWeight)
  const minReps = Math.min(...workSets.map((s) => s.reps || 0))
  const lastSummary = { date: last.date, weight: weighted ? workWeight : null, sets: last.sets.length, reps: minReps }

  if (minReps >= exercise.rep_high) {
    if (weighted && !gentle) {
      return { weight: +(workWeight + exercise.increment).toFixed(2), reps: exercise.rep_low, sets, direction: 'up',
        rationale: `Last time you hit ${minReps} ${repNoun} — top of your range. Go up ${exercise.increment}${exercise.unit}.`, last: lastSummary }
    }
    return { weight: weighted ? workWeight : null, reps: minReps + 1, sets, direction: 'up',
      rationale: `You maxed the range — add ${exercise.unit === 'time' ? 'a few seconds' : 'a rep'}.`, last: lastSummary }
  }
  if (minReps >= exercise.rep_low) {
    return { weight: weighted ? workWeight : null, reps: Math.min(minReps + 1, exercise.rep_high), sets, direction: 'hold',
      rationale: `Same ${weighted ? 'weight' : 'level'}, aim for ${Math.min(minReps + 1, exercise.rep_high)} ${repNoun} to keep progressing.`, last: lastSummary }
  }
  // Missed the bottom of the range.
  if (weighted && !gentle) {
    return { weight: +Math.max(0, workWeight - exercise.increment).toFixed(2), reps: exercise.rep_low, sets, direction: 'down',
      rationale: `Last time was a grind (${minReps} ${repNoun}). Drop ${exercise.increment}${exercise.unit} and rebuild clean ${repNoun}.`, last: lastSummary }
  }
  return { weight: weighted ? workWeight : null, reps: exercise.rep_low, sets, direction: 'hold',
    rationale: `Hold here and groove the movement before progressing.`, last: lastSummary }
}
