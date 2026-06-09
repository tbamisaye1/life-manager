import { useState } from 'react'
import { Trash2, X, Plus } from 'lucide-react'
import { Card, CardBody, Badge, Button, IconButton, Select, Label } from '../ui'
import { useDeleteRoutine, useAddRoutineExercise, useRemoveRoutineExercise, useExercises } from '../../hooks/useGym'

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** A routine card: name, emoji, weekday, exercise list with add/remove. */
export function RoutineCard({ routine }) {
  const [addingExercise, setAddingExercise] = useState(false)
  const [selectedExId, setSelectedExId] = useState('')
  const [targetSets, setTargetSets] = useState(3)

  const { data: allExercises = [] } = useExercises()
  const deleteRoutine = useDeleteRoutine()
  const addEx = useAddRoutineExercise()
  const removeEx = useRemoveRoutineExercise()

  const existingIds = new Set(routine.exercises?.map((e) => e.id) ?? [])
  const availableExercises = allExercises.filter((ex) => !ex.archived && !existingIds.has(ex.id))

  const handleDelete = () => {
    if (!window.confirm(`Delete routine "${routine.name}"? This can't be undone.`)) return
    deleteRoutine.mutate(routine.id)
  }

  const handleAddExercise = () => {
    if (!selectedExId) return
    addEx.mutate(
      { routineId: routine.id, exercise_id: selectedExId, target_sets: Number(targetSets) },
      {
        onSuccess: () => {
          setAddingExercise(false)
          setSelectedExId('')
          setTargetSets(3)
        },
      },
    )
  }

  const handleRemoveExercise = (rexId) => {
    removeEx.mutate({ routineId: routine.id, rexId })
  }

  return (
    <Card>
      <CardBody className="p-4">
        {/* Header */}
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {routine.emoji && <span className="text-xl">{routine.emoji}</span>}
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">{routine.name}</h3>
              {routine.weekday != null && (
                <Badge tone="neutral" className="mt-0.5">{WEEKDAY_NAMES[routine.weekday]}</Badge>
              )}
            </div>
          </div>
          <IconButton
            label="Delete routine"
            onClick={handleDelete}
            disabled={deleteRoutine.isPending}
            className="text-zinc-300 hover:text-red-500 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>

        {/* Exercise list */}
        {routine.exercises?.length > 0 ? (
          <div className="mb-3 space-y-1">
            {routine.exercises.map((ex) => (
              <div
                key={ex.routine_exercise_id}
                className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2"
              >
                <div>
                  <span className="text-xs font-medium text-zinc-700">{ex.name}</span>
                  <span className="ml-2 text-xs text-zinc-400">{ex.target_sets} sets</span>
                </div>
                <IconButton
                  label="Remove exercise"
                  onClick={() => handleRemoveExercise(ex.routine_exercise_id)}
                  disabled={removeEx.isPending}
                  className="h-6 w-6 text-zinc-300 hover:text-red-500 hover:bg-red-50"
                >
                  <X className="h-3 w-3" />
                </IconButton>
              </div>
            ))}
          </div>
        ) : (
          <p className="mb-3 text-xs text-zinc-400">No exercises yet.</p>
        )}

        {/* Add exercise inline */}
        {addingExercise ? (
          <div className="rounded-lg border border-zinc-200 p-3 space-y-2">
            <div>
              <Label htmlFor={`ex-select-${routine.id}`}>Exercise</Label>
              <Select
                id={`ex-select-${routine.id}`}
                value={selectedExId}
                onChange={(e) => setSelectedExId(e.target.value)}
              >
                <option value="">— Pick exercise —</option>
                {availableExercises.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor={`sets-select-${routine.id}`}>Target sets</Label>
              <Select
                id={`sets-select-${routine.id}`}
                value={targetSets}
                onChange={(e) => setTargetSets(e.target.value)}
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </Select>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="primary" onClick={handleAddExercise} disabled={!selectedExId || addEx.isPending}>
                Add
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAddingExercise(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setAddingExercise(true)} className="w-full">
            <Plus className="h-3.5 w-3.5" /> Add exercise
          </Button>
        )}
      </CardBody>
    </Card>
  )
}
