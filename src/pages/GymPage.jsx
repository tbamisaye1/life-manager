import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dumbbell, Calendar, BookOpen, BarChart2, Plus, Play, ChevronRight } from 'lucide-react'
import { PageHeader, Button, Card, CardBody, EmptyState, Loading, ErrorState, Modal, Input, Select, Label, Textarea } from '../components/ui'
import { GymTabs } from '../components/gym/GymTabs'
import { RoutineCard } from '../components/gym/RoutineCard'
import { WeekSchedule } from '../components/gym/WeekSchedule'
import { ExerciseLibrary } from '../components/gym/ExerciseLibrary'
import { ExerciseProgress } from '../components/gym/ExerciseProgress'
import { useGymToday, useRoutines, useSchedule, useCreateWorkout, useCreateRoutine } from '../hooks/useGym'
import { formatDate } from '../lib/format'
import { cn } from '../lib/cn'
import { PROJECT_COLORS, colorClasses } from '../lib/colors'

const TABS = [
  { key: 'today', label: 'Today', icon: Calendar },
  { key: 'plan', label: 'Plan', icon: Dumbbell },
  { key: 'exercises', label: 'Exercises', icon: BookOpen },
  { key: 'progress', label: 'Progress', icon: BarChart2 },
]

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const EMOJI_OPTIONS = ['💪', '🏋️', '🤸', '🦵', '🏃', '🧘', '⚡', '🔥']

// ─── Today tab ────────────────────────────────────────────────────────────────
function TodayTab() {
  const navigate = useNavigate()
  const { data: today, isLoading, isError, refetch } = useGymToday()
  const createWorkout = useCreateWorkout()

  if (isLoading) return <Loading label="Loading today…" />
  if (isError) return <ErrorState message="Couldn't load today's schedule" onRetry={refetch} />

  const scheduled = today?.scheduled ?? []
  const workouts = today?.workouts ?? []

  const startRoutine = (routineId) => {
    createWorkout.mutate(
      { routine_id: routineId, date: today.date },
      { onSuccess: (workout) => navigate(`/gym/workout/${workout.id}`) },
    )
  }

  const startEmpty = () => {
    createWorkout.mutate(
      { date: today.date },
      { onSuccess: (workout) => navigate(`/gym/workout/${workout.id}`) },
    )
  }

  // Map existing workouts by routine_id for quick lookup
  const workoutByRoutine = {}
  for (const w of workouts) {
    if (w.routine_id) workoutByRoutine[w.routine_id] = w
  }
  const emptyWorkout = workouts.find((w) => !w.routine_id)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-500">{formatDate(today?.date ?? new Date())}</p>
      </div>

      {/* Scheduled routines */}
      {scheduled.length > 0 ? (
        <div className="space-y-3">
          {scheduled.map((routine) => {
            const existing = workoutByRoutine[routine.id]
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
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate(`/gym/workout/${existing.id}`)}
                    >
                      <ChevronRight className="h-4 w-4" /> Continue
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => startRoutine(routine.id)}
                      disabled={createWorkout.isPending}
                    >
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
          description="No routine is planned for today. Start an empty workout or head to Plan to set up your week."
        />
      )}

      {/* Previous workouts from today that aren't tied to a routine */}
      {workouts.filter((w) => !w.routine_id && !w.completed).length > 0 && (
        <div className="space-y-2">
          {workouts
            .filter((w) => !w.routine_id && !w.completed)
            .map((w) => (
              <Card key={w.id} interactive onClick={() => navigate(`/gym/workout/${w.id}`)}>
                <CardBody className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-medium text-zinc-800">{w.title ?? 'Open workout'}</p>
                    <p className="text-xs text-zinc-400">In progress</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-zinc-400" />
                </CardBody>
              </Card>
            ))}
        </div>
      )}

      {/* Start empty workout */}
      {!emptyWorkout && (
        <Button
          variant="ghost"
          size="sm"
          onClick={startEmpty}
          disabled={createWorkout.isPending}
          className="w-full text-zinc-400 hover:text-zinc-600"
        >
          <Plus className="h-4 w-4" /> Start empty workout
        </Button>
      )}
    </div>
  )
}

// ─── Plan tab ─────────────────────────────────────────────────────────────────
function NewRoutineModal({ open, onClose }) {
  const [form, setForm] = useState({ name: '', emoji: '💪', color: 'violet', weekday: '', notes: '' })
  const create = useCreateRoutine()

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = {
      ...form,
      weekday: form.weekday !== '' ? Number(form.weekday) : null,
    }
    create.mutate(payload, { onSuccess: onClose })
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New routine"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" type="submit" form="new-routine-form" disabled={create.isPending}>
            Create
          </Button>
        </>
      }
    >
      <form id="new-routine-form" onSubmit={handleSubmit} className="space-y-3">
        <div>
          <Label htmlFor="routine-name">Name</Label>
          <Input
            id="routine-name"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Upper Body"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Emoji</Label>
            <div className="flex flex-wrap gap-1">
              {EMOJI_OPTIONS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => set('emoji', em)}
                  className={`rounded-lg p-1.5 text-lg transition-colors ${form.emoji === em ? 'bg-accent-100 ring-1 ring-accent-400' : 'hover:bg-zinc-100'}`}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="routine-weekday">Day (optional)</Label>
            <Select id="routine-weekday" value={form.weekday} onChange={(e) => set('weekday', e.target.value)}>
              <option value="">No fixed day</option>
              {WEEKDAY_NAMES.map((name, i) => (
                <option key={i} value={i}>{name}</option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Label>Color</Label>
          <div className="flex flex-wrap gap-1.5">
            {PROJECT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => set('color', c)}
                className={cn('h-6 w-6 rounded-full ring-2 ring-offset-1 transition', colorClasses(c).dot,
                  form.color === c ? 'ring-zinc-400' : 'ring-transparent')}
              />
            ))}
          </div>
        </div>
        <div>
          <Label htmlFor="routine-notes">Notes (optional)</Label>
          <Textarea
            id="routine-notes"
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            className="min-h-[56px]"
            placeholder="Focus, goals, etc."
          />
        </div>
      </form>
    </Modal>
  )
}

function PlanTab() {
  const { data: routines = [], isLoading: rLoading, isError: rError, refetch: rRefetch } = useRoutines()
  const { data: schedule, isLoading: sLoading } = useSchedule()
  const [newRoutineOpen, setNewRoutineOpen] = useState(false)

  if (rLoading || sLoading) return <Loading label="Loading plan…" />
  if (rError) return <ErrorState message="Couldn't load routines" onRetry={rRefetch} />

  return (
    <div>
      {/* Week overview */}
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">This week</p>
      <WeekSchedule schedule={schedule} />

      {/* Routines */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Routines</p>
        <Button variant="primary" size="sm" onClick={() => setNewRoutineOpen(true)}>
          <Plus className="h-4 w-4" /> New routine
        </Button>
      </div>

      {routines.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title="No routines yet"
          description="Create a routine, add exercises, and assign it to a day."
          action={
            <Button variant="primary" onClick={() => setNewRoutineOpen(true)}>
              <Plus className="h-4 w-4" /> New routine
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {routines.map((r) => (
            <RoutineCard key={r.id} routine={r} />
          ))}
        </div>
      )}

      <NewRoutineModal open={newRoutineOpen} onClose={() => setNewRoutineOpen(false)} />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function GymPage() {
  const [tab, setTab] = useState('today')

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Gym & Rehab"
        subtitle="Track sessions, hit new PRs, stay consistent."
        icon={Dumbbell}
      />

      <GymTabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'today' && <TodayTab />}
      {tab === 'plan' && <PlanTab />}
      {tab === 'exercises' && <ExerciseLibrary />}
      {tab === 'progress' && <ExerciseProgress />}
    </div>
  )
}
