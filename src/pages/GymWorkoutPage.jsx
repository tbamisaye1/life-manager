import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Dumbbell, ArrowLeft, CheckCircle, Plus } from 'lucide-react'
import { PageHeader, Button, Card, CardBody, EmptyState, Loading, ErrorState, Modal, Select, Label } from '../components/ui'
import { ExerciseLogCard } from '../components/gym/ExerciseLogCard'
import { useWorkout, useUpdateWorkout, useAddSet, useExercises } from '../hooks/useGym'
import { formatDate } from '../lib/format'

/**
 * Modal to add an ad-hoc exercise to an open workout.
 * Posts a first set (weight=null, reps from rep_low) which creates the exercise
 * entry on the workout. The user can then adjust via SetRow.
 */
function AddExerciseModal({ open, onClose, workoutId, existingExerciseIds = [] }) {
  const [selectedId, setSelectedId] = useState('')
  const { data: exercises = [] } = useExercises()
  const addSet = useAddSet()

  const available = exercises.filter((ex) => !ex.archived && !existingExerciseIds.includes(ex.id))

  const handleAdd = () => {
    if (!selectedId) return
    const ex = exercises.find((e) => e.id === selectedId)
    addSet.mutate(
      {
        workoutId,
        exercise_id: selectedId,
        weight: null,
        reps: ex?.rep_low ?? 8,
      },
      { onSuccess: () => onClose() },
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add exercise"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleAdd} disabled={!selectedId || addSet.isPending}>
            Add
          </Button>
        </>
      }
    >
      <div>
        <Label htmlFor="add-ex-select">Exercise</Label>
        <Select id="add-ex-select" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          <option value="">— Select —</option>
          {available.map((ex) => (
            <option key={ex.id} value={ex.id}>{ex.name}</option>
          ))}
        </Select>
      </div>
    </Modal>
  )
}

/** Finish confirmation modal */
function FinishModal({ open, onClose, onConfirm, isPending }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Finish workout?"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Keep going</Button>
          <Button variant="primary" onClick={onConfirm} disabled={isPending}>
            <CheckCircle className="h-4 w-4" /> Finish
          </Button>
        </>
      }
    >
      <p className="text-sm text-zinc-600">
        Mark this workout as complete. You can still view it afterwards.
      </p>
    </Modal>
  )
}

export default function GymWorkoutPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [finishOpen, setFinishOpen] = useState(false)
  const [addExOpen, setAddExOpen] = useState(false)

  const { data: workout, isLoading, isError, refetch: refetchWorkout } = useWorkout(id)
  const updateWorkout = useUpdateWorkout()

  if (isLoading) return <Loading label="Loading workout…" />
  if (isError) return <ErrorState message="Couldn't load workout" onRetry={refetchWorkout} />

  const exercises = workout?.exercises ?? []
  const existingExIds = exercises.map((e) => e.exercise.id)

  const handleFinish = () => {
    updateWorkout.mutate(
      { id, completed: true },
      { onSuccess: () => navigate('/gym') },
    )
  }

  const dateLabel = workout?.date ? formatDate(workout.date, 'EEEE, MMM d') : ''

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={workout?.title ?? 'Workout'}
        subtitle={dateLabel}
        icon={Dumbbell}
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/gym"
              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-500 hover:bg-zinc-100 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
            {!workout?.completed && (
              <Button variant="primary" size="sm" onClick={() => setFinishOpen(true)}>
                <CheckCircle className="h-4 w-4" /> Finish workout
              </Button>
            )}
          </div>
        }
      />

      {workout?.completed && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle className="h-4 w-4 text-emerald-600" />
          <p className="text-sm font-medium text-emerald-700">Workout complete — great work!</p>
        </div>
      )}

      {/* Exercise cards */}
      {exercises.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title="No exercises in this workout"
          description="This is an empty workout. Add exercises to get started."
          action={
            <Button variant="primary" onClick={() => setAddExOpen(true)}>
              <Plus className="h-4 w-4" /> Add exercise
            </Button>
          }
        />
      ) : (
        <div>
          {exercises.map((workoutExercise) => (
            <ExerciseLogCard
              key={workoutExercise.exercise.id}
              workoutExercise={workoutExercise}
              workoutId={id}
            />
          ))}

          {/* Add another exercise */}
          {!workout?.completed && (
            <Card className="border-dashed">
              <CardBody className="p-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAddExOpen(true)}
                  className="w-full text-zinc-400 hover:text-zinc-600"
                >
                  <Plus className="h-4 w-4" /> Add exercise
                </Button>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {workout?.notes && (
        <div className="mt-4 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3">
          <p className="text-xs font-medium text-zinc-400 mb-1">Notes</p>
          <p className="text-sm text-zinc-700">{workout.notes}</p>
        </div>
      )}

      <FinishModal
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        onConfirm={handleFinish}
        isPending={updateWorkout.isPending}
      />

      <AddExerciseModal
        open={addExOpen}
        onClose={() => setAddExOpen(false)}
        workoutId={id}
        existingExerciseIds={existingExIds}
      />
    </div>
  )
}
