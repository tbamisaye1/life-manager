import { useNavigate } from 'react-router-dom'
import { Calendar, Play, ChevronRight, Plus } from 'lucide-react'
import { Card, CardBody, Button, EmptyState, Loading, ErrorState } from '../ui'
import { useGymToday, useCreateWorkout } from '../../hooks/useGym'
import { formatDate } from '../../lib/format'

/** Today tab: scheduled routine(s) for today + start/continue + start empty. */
export function GymTodayTab() {
  const navigate = useNavigate()
  const { data: today, isLoading, isError, refetch } = useGymToday()
  const createWorkout = useCreateWorkout()

  if (isLoading) return <Loading label="Loading today…" />
  if (isError) return <ErrorState message="Couldn't load today's schedule" onRetry={refetch} />

  const scheduled = today?.scheduled ?? []
  const workouts = today?.workouts ?? []
  const open = (id) => navigate(`/gym/workout/${id}`)
  const start = (routineId) =>
    createWorkout.mutate({ routine_id: routineId, date: today.date }, { onSuccess: (w) => open(w.id) })
  const startEmpty = () => createWorkout.mutate({ date: today.date }, { onSuccess: (w) => open(w.id) })

  const byRoutine = {}
  for (const w of workouts) if (w.routine_id) byRoutine[w.routine_id] = w
  const emptyWorkout = workouts.find((w) => !w.routine_id)

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-zinc-500">{formatDate(today?.date ?? new Date())}</p>

      {scheduled.length > 0 ? (
        <div className="space-y-3">
          {scheduled.map((routine) => {
            const existing = byRoutine[routine.id]
            return (
              <Card key={routine.id}>
                <CardBody className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    {routine.emoji && <span className="text-2xl">{routine.emoji}</span>}
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">{routine.name}</p>
                      <p className="text-xs text-zinc-400">Scheduled for today</p>
                    </div>
                  </div>
                  {existing ? (
                    <Button variant="secondary" size="sm" onClick={() => open(existing.id)}>
                      <ChevronRight className="h-4 w-4" /> Continue
                    </Button>
                  ) : (
                    <Button variant="primary" size="sm" onClick={() => start(routine.id)} disabled={createWorkout.isPending}>
                      <Play className="h-4 w-4" /> Start
                    </Button>
                  )}
                </CardBody>
              </Card>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon={Calendar}
          title="Nothing scheduled today"
          description="No routine planned for today. Start an empty workout, or head to Plan to set up your week."
        />
      )}

      {workouts.filter((w) => !w.routine_id && !w.completed).map((w) => (
        <Card key={w.id} interactive onClick={() => open(w.id)}>
          <CardBody className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium text-zinc-800">{w.title ?? 'Open workout'}</p>
              <p className="text-xs text-zinc-400">In progress</p>
            </div>
            <ChevronRight className="h-4 w-4 text-zinc-400" />
          </CardBody>
        </Card>
      ))}

      {!emptyWorkout && (
        <Button variant="ghost" size="sm" onClick={startEmpty} disabled={createWorkout.isPending} className="w-full text-zinc-400 hover:text-zinc-600">
          <Plus className="h-4 w-4" /> Start empty workout
        </Button>
      )}
    </div>
  )
}
