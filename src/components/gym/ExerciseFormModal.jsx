import { useState } from 'react'
import { Modal, Button, Input, Textarea, Select, Label } from '../ui'
import { useCreateExercise, useUpdateExercise } from '../../hooks/useGym'

const CATEGORIES = ['strength', 'rehab', 'mobility', 'conditioning']
const UNITS = ['kg', 'lb', 'bodyweight', 'band', 'time']

const DEFAULT_FORM = {
  name: '',
  category: 'strength',
  muscle_group: '',
  unit: 'kg',
  rep_low: 8,
  rep_high: 12,
  default_sets: 3,
  target_weight: '',
  increment: 2.5,
  notes: '',
}

function buildForm(exercise) {
  return exercise ? { ...DEFAULT_FORM, ...exercise } : DEFAULT_FORM
}

/** Modal for creating or editing an exercise in the library.
 *  The caller must pass a key (e.g. exercise?.id ?? 'new') so React remounts
 *  when switching between create/edit, resetting form state naturally.
 */
export function ExerciseFormModal({ open, onClose, exercise }) {
  const [form, setForm] = useState(() => buildForm(exercise))
  const create = useCreateExercise()
  const update = useUpdateExercise()

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = {
      ...form,
      rep_low: Number(form.rep_low),
      rep_high: Number(form.rep_high),
      default_sets: Number(form.default_sets),
      target_weight: form.target_weight === '' || form.target_weight == null ? null : Number(form.target_weight),
      increment: Number(form.increment),
    }
    if (exercise) {
      update.mutate({ id: exercise.id, ...payload }, { onSuccess: onClose })
    } else {
      create.mutate(payload, { onSuccess: onClose })
    }
  }

  const pending = create.isPending || update.isPending

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={exercise ? 'Edit exercise' : 'New exercise'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button variant="primary" type="submit" form="exercise-form" disabled={pending}>
            {exercise ? 'Save changes' : 'Add exercise'}
          </Button>
        </>
      }
    >
      <form id="exercise-form" onSubmit={handleSubmit} className="space-y-3">
        <div>
          <Label htmlFor="ex-name">Name</Label>
          <Input
            id="ex-name"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Bench Press"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="ex-category">Category</Label>
            <Select id="ex-category" value={form.category} onChange={(e) => set('category', e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="ex-unit">Unit</Label>
            <Select id="ex-unit" value={form.unit} onChange={(e) => set('unit', e.target.value)}>
              {UNITS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="ex-muscle">Muscle group</Label>
          <Input
            id="ex-muscle"
            value={form.muscle_group}
            onChange={(e) => set('muscle_group', e.target.value)}
            placeholder="e.g. Chest, Triceps"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="ex-rep-low">Target reps (min)</Label>
            <Input
              id="ex-rep-low"
              type="number"
              min={1}
              value={form.rep_low}
              onChange={(e) => set('rep_low', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="ex-rep-high">Target reps (max)</Label>
            <Input
              id="ex-rep-high"
              type="number"
              min={1}
              value={form.rep_high}
              onChange={(e) => set('rep_high', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="ex-sets">Target sets</Label>
            <Input
              id="ex-sets"
              type="number"
              min={1}
              value={form.default_sets}
              onChange={(e) => set('default_sets', e.target.value)}
            />
          </div>
        </div>

        {(form.unit === 'kg' || form.unit === 'lb') && (
          <div>
            <Label htmlFor="ex-target-weight">Target weight ({form.unit})</Label>
            <Input
              id="ex-target-weight"
              type="number"
              min={0}
              step={0.5}
              value={form.target_weight ?? ''}
              onChange={(e) => set('target_weight', e.target.value)}
              placeholder="e.g. 20 — your working-weight goal"
            />
          </div>
        )}

        <div>
          <Label htmlFor="ex-increment">Weight increment ({form.unit})</Label>
          <Input
            id="ex-increment"
            type="number"
            min={0}
            step={0.5}
            value={form.increment}
            onChange={(e) => set('increment', e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="ex-notes">Notes (optional)</Label>
          <Textarea
            id="ex-notes"
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Form cues, mobility notes, etc."
            className="min-h-[60px]"
          />
        </div>
      </form>
    </Modal>
  )
}
