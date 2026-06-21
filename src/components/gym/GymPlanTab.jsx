import { useState } from 'react'
import { Dumbbell, Plus } from 'lucide-react'
import { Button, EmptyState, Loading, ErrorState, Modal, Input, Select, Label, Textarea } from '../ui'
import { WeekSchedule } from './WeekSchedule'
import { RoutineCard } from './RoutineCard'
import { useRoutines, useSchedule, useCreateRoutine } from '../../hooks/useGym'
import { cn } from '../../lib/cn'
import { PROJECT_COLORS, colorClasses } from '../../lib/colors'

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const EMOJI_OPTIONS = ['💪', '🏋️', '🤸', '🦵', '🏃', '🧘', '⚡', '🔥']

function NewRoutineModal({ open, onClose }) {
  const [form, setForm] = useState({ name: '', emoji: '💪', color: 'violet', weekday: '', notes: '' })
  const [error, setError] = useState(null)
  const create = useCreateRoutine()
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = (e) => {
    e?.preventDefault()
    if (!form.name.trim()) {
      setError('Name is required')
      return
    }
    setError(null)
    create.mutate(
      { ...form, weekday: form.weekday !== '' ? Number(form.weekday) : null },
      {
        onSuccess: onClose,
        onError: (err) => setError(err.message || 'Could not create routine'),
      },
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New routine"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={create.isPending}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={create.isPending || !form.name.trim()}>
            Create
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        <div>
          <Label htmlFor="routine-name">Name</Label>
          <Input id="routine-name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Upper Body" required />
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
                  className={cn('rounded-lg p-1.5 text-lg transition-colors', form.emoji === em ? 'bg-accent-100 ring-1 ring-accent-400' : 'hover:bg-zinc-100')}
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
              {WEEKDAY_NAMES.map((name, i) => <option key={i} value={i}>{name}</option>)}
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
                className={cn('h-6 w-6 rounded-full ring-2 ring-offset-1 transition', colorClasses(c).dot, form.color === c ? 'ring-zinc-400' : 'ring-transparent')}
              />
            ))}
          </div>
        </div>
        <div>
          <Label htmlFor="routine-notes">Notes (optional)</Label>
          <Textarea id="routine-notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} className="min-h-[56px]" placeholder="Focus, goals, etc." />
        </div>
      </form>
    </Modal>
  )
}

/** Plan tab: weekly schedule overview + routine management. */
export function GymPlanTab() {
  const { data: routines = [], isLoading: rLoading, isError: rError, refetch } = useRoutines()
  const { data: schedule, isLoading: sLoading } = useSchedule()
  const [newOpen, setNewOpen] = useState(false)

  if (rLoading || sLoading) return <Loading label="Loading plan…" />
  if (rError) return <ErrorState message="Couldn't load routines" onRetry={refetch} />

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">This week</p>
      <WeekSchedule schedule={schedule} />

      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Routines</p>
        <Button variant="primary" size="sm" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> New routine</Button>
      </div>

      {routines.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title="No routines yet"
          description="Create a routine, add exercises, and assign it to a day."
          action={<Button variant="primary" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> New routine</Button>}
        />
      ) : (
        <div className="space-y-4">
          {routines.map((r) => <RoutineCard key={r.id} routine={r} />)}
        </div>
      )}

      <NewRoutineModal key={newOpen ? 'open' : 'closed'} open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  )
}
