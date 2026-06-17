import { Pencil, Trash2 } from 'lucide-react'
import { IconButton, Badge } from '../ui'
import { useDeleteExercise } from '../../hooks/useGym'

const CATEGORY_TONE = {
  strength: 'accent',
  rehab: 'green',
  mobility: 'blue',
  conditioning: 'amber',
}

/** A single exercise row in the library list. */
export function ExerciseRow({ exercise, onEdit }) {
  const del = useDeleteExercise()

  const handleDelete = () => {
    if (!window.confirm(`Delete "${exercise.name}"? This can't be undone.`)) return
    del.mutate(exercise.id)
  }

  return (
    <div className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3 last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-zinc-800">{exercise.name}</span>
          <Badge tone={CATEGORY_TONE[exercise.category] ?? 'neutral'}>{exercise.category}</Badge>
          <Badge tone="neutral">{exercise.unit}</Badge>
        </div>
        <p className="mt-0.5 text-xs text-zinc-400">
          {exercise.muscle_group && <span>{exercise.muscle_group} · </span>}
          {exercise.rep_low}–{exercise.rep_high} reps · {exercise.default_sets} sets
          {exercise.target_weight != null ? ` · @ ${exercise.target_weight}${exercise.unit}` : ''}
          {exercise.increment ? ` · +${exercise.increment}${exercise.unit}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <IconButton label="Edit exercise" onClick={() => onEdit(exercise)}>
          <Pencil className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton
          label="Delete exercise"
          onClick={handleDelete}
          disabled={del.isPending}
          className="text-zinc-400 hover:text-red-500 hover:bg-red-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </IconButton>
      </div>
    </div>
  )
}
