/**
 * Parse common gym shorthand from user speech / chat.
 * Convention: sets×reps first (5x5 = 5 sets of 5 reps).
 */
export function parseGymNotation(text) {
  const raw = String(text || '').trim()
  if (!raw) return null

  const out = { sets: undefined, reps: undefined, weight: undefined }

  const nxn = /(\d+)\s*[x×]\s*(\d+)/i.exec(raw)
  if (nxn) {
    out.sets = Number(nxn[1])
    out.reps = Number(nxn[2])
  }

  if (!out.sets) {
    const sof = /(\d+)\s*sets?\s+of\s+(\d+)/i.exec(raw)
    if (sof) {
      out.sets = Number(sof[1])
      out.reps = Number(sof[2])
    }
  }

  const wAt = /@\s*(\d+(?:\.\d+)?)\s*(kg|lb|kgs|lbs)?/i.exec(raw)
    || /\bat\s+(\d+(?:\.\d+)?)\s*(kg|lb|kgs|lbs)?/i.exec(raw)
    || /(\d+(?:\.\d+)?)\s*(kg|lb)\b/i.exec(raw)
  if (wAt) out.weight = Number(wAt[1])

  if (out.sets === undefined && out.reps === undefined && out.weight === undefined) return null
  return out
}

/** Merge explicit fields with parsed notation (explicit wins). */
export function resolveGymFields({ notation, sets, reps, weight }) {
  const parsed = notation ? parseGymNotation(notation) : null
  return {
    sets: sets ?? parsed?.sets,
    reps: reps ?? parsed?.reps,
    weight: weight ?? parsed?.weight,
  }
}

/** Turn gym shorthand into exercise-library targets (standard / goal). */
export function parseExerciseGoal(text) {
  const parsed = parseGymNotation(text)
  if (!parsed?.sets && !parsed?.reps) return null
  const reps = parsed.reps ?? parsed.sets
  const sets = parsed.sets ?? parsed.reps
  return {
    default_sets: sets,
    rep_low: reps,
    rep_high: reps,
    target_weight: parsed.weight ?? undefined,
  }
}
