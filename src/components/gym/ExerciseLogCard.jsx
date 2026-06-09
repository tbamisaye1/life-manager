import { Plus } from 'lucide-react'
import { Card, CardBody, Button } from '../ui'
import { SuggestionChip } from './SuggestionChip'
import { SetRow } from './SetRow'
import { useAddSet } from '../../hooks/useGym'

/**
 * One exercise within a workout logging screen.
 * Shows suggestion, existing sets, and a prefilled "+ Add set" button.
 */
export function ExerciseLogCard({ workoutExercise, workoutId }) {
  const { exercise, suggestion, sets = [], target_sets } = workoutExercise
  const addSet = useAddSet()

  const handleAddSet = () => {
    // Prefill from suggestion if no sets yet, else use last set's values
    let weight = null
    let reps = exercise.rep_low ?? 8

    if (sets.length > 0) {
      const last = sets[sets.length - 1]
      weight = last.weight
      reps = last.reps
    } else if (suggestion) {
      weight = suggestion.weight ?? null
      reps = suggestion.reps ?? exercise.rep_low ?? 8
    }

    addSet.mutate({
      workoutId,
      exercise_id: exercise.id,
      weight,
      reps,
    })
  }

  const completedSets = sets.filter((s) => s.done).length
  const totalSets = target_sets ?? sets.length

  return (
    <Card className="mb-4">
      <CardBody className="p-4">
        {/* Header */}
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">{exercise.name}</h3>
            {exercise.muscle_group && (
              <p className="text-xs text-zinc-400">{exercise.muscle_group}</p>
            )}
          </div>
          {target_sets != null && (
            <span className="text-xs font-medium text-zinc-400 whitespace-nowrap">
              {completedSets}/{target_sets} sets
            </span>
          )}
        </div>

        {/* Suggestion */}
        {suggestion && (
          <div className="mb-3">
            <SuggestionChip suggestion={suggestion} unit={exercise.unit} />
          </div>
        )}

        {/* Sets */}
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

        {/* Add set */}
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
  )
}
