import { useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { Card, CardBody, Button, IconButton } from '../ui'
import { SuggestionChip } from './SuggestionChip'
import { SetRow } from './SetRow'
import { ExerciseFormModal } from './ExerciseFormModal'
import { useAddSet } from '../../hooks/useGym'

function formatTarget(exercise, targetSets) {
  const sets = targetSets ?? exercise.default_sets ?? 3
  const rep =
    exercise.rep_low && exercise.rep_high && exercise.rep_low !== exercise.rep_high
      ? `${exercise.rep_low}–${exercise.rep_high}`
      : exercise.rep_low || exercise.rep_high || '?'
  const repWord = exercise.unit === 'time' ? 'sec' : 'reps'
  let line = `Target: ${sets} × ${rep} ${repWord}`
  if ((exercise.unit === 'kg' || exercise.unit === 'lb') && exercise.target_weight != null) {
    line += ` @ ${exercise.target_weight}${exercise.unit}`
  }
  return line
}

/**
 * One exercise within a workout logging screen.
 * Shows target standard, suggestion, existing sets, and quick edit for goals.
 */
export function ExerciseLogCard({ workoutExercise, workoutId }) {
  const { exercise, suggestion, sets = [], target_sets } = workoutExercise
  const addSet = useAddSet()
  const [editOpen, setEditOpen] = useState(false)

  const handleAddSet = () => {
    let weight = null
    let reps = exercise.rep_low ?? 8

    if (sets.length > 0) {
      const last = sets[sets.length - 1]
      weight = last.weight
      reps = last.reps
    } else if (suggestion) {
      weight = suggestion.weight ?? exercise.target_weight ?? null
      reps = suggestion.reps ?? exercise.rep_low ?? 8
    } else if (exercise.target_weight != null) {
      weight = exercise.target_weight
    }

    addSet.mutate({
      workoutId,
      exercise_id: exercise.id,
      weight,
      reps,
    })
  }

  const completedSets = sets.filter((s) => s.done).length
  const totalSets = target_sets ?? exercise.default_sets ?? sets.length

  return (
    <>
      <Card className="mb-4">
        <CardBody className="p-4">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <h3 className="text-sm font-semibold text-zinc-900">{exercise.name}</h3>
                <IconButton label="Edit exercise target" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-3.5 w-3.5" />
                </IconButton>
              </div>
              {exercise.muscle_group && (
                <p className="text-xs text-zinc-400">{exercise.muscle_group}</p>
              )}
              <p className="mt-1 text-xs font-medium text-violet-700">{formatTarget(exercise, target_sets)}</p>
            </div>
            {target_sets != null && (
              <span className="text-xs font-medium text-zinc-400 whitespace-nowrap">
                {completedSets}/{target_sets} sets
              </span>
            )}
          </div>

          {suggestion && (
            <div className="mb-3">
              <SuggestionChip suggestion={suggestion} unit={exercise.unit} />
            </div>
          )}

          {sets.length > 0 && (
            <div className="mb-3 space-y-1.5">
              {sets.map((set) => (
                <SetRow
                  key={set.id}
                  set={set}
                  workoutId={workoutId}
                  increment={exercise.increment ?? 2.5}
                  exerciseUnit={exercise.unit}
                />
              ))}
            </div>
          )}

          <Button
            variant={sets.length === 0 ? 'primary' : 'secondary'}
            size="sm"
            onClick={handleAddSet}
            disabled={addSet.isPending}
            className="w-full"
          >
            <Plus className="h-3.5 w-3.5" />
            {sets.length === 0
              ? `Start — Set 1 of ${totalSets}`
              : `+ Add set (${sets.length + 1}${target_sets ? ` of ${totalSets}` : ''})`}
          </Button>
        </CardBody>
      </Card>

      <ExerciseFormModal
        key={exercise.id}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        exercise={exercise}
      />
    </>
  )
}
