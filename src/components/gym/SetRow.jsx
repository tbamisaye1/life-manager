import { useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { cn } from '../../lib/cn'
import { IconButton, Checkbox } from '../ui'
import { useUpdateSet, useDeleteSet } from '../../hooks/useGym'

/** Stepper: − [number] + with direct typing. Larger tap targets for mid-workout use. */
function Stepper({ value, onChange, step = 1, min = 0, label, unit }) {
  const handleMinus = () => onChange(Math.max(min, (Number(value) || 0) - step))
  const handlePlus = () => onChange((Number(value) || 0) + step)
  const handleInput = (e) => {
    if (e.target.value === '') return onChange('')
    const v = parseFloat(e.target.value)
    if (!isNaN(v) && v >= min) onChange(v)
  }
  return (
    <div className="flex items-center gap-1">
      <IconButton label={`Decrease ${label}`} onClick={handleMinus} className="h-10 w-10 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
        <span className="text-lg leading-none">−</span>
      </IconButton>
      <div className="flex flex-col items-center">
        <input
          type="number"
          value={value ?? ''}
          onChange={handleInput}
          className={cn(
            'h-10 rounded-lg border border-zinc-200 bg-white text-center text-base font-medium text-zinc-800',
            'focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/30',
            unit === 'kg' || unit === 'lb' ? 'w-16' : 'w-14',
          )}
          min={min}
          step={step}
        />
        {unit && <span className="mt-0.5 text-[11px] text-zinc-400">{unit}</span>}
      </div>
      <IconButton label={`Increase ${label}`} onClick={handlePlus} className="h-10 w-10 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
        <span className="text-lg leading-none">+</span>
      </IconButton>
    </div>
  )
}

/**
 * One logged set row. Holds weight/reps in LOCAL state (seeded once from the
 * set) so a background workout refetch can't clobber an in-flight edit; pushes
 * to the server via a debounced PATCH.
 */
export function SetRow({ set, workoutId, increment = 2.5, exerciseUnit }) {
  const updateSet = useUpdateSet()
  const deleteSet = useDeleteSet()
  const timerRef = useRef(null)
  const [weight, setWeight] = useState(set.weight)
  const [reps, setReps] = useState(set.reps)

  const push = (patch) => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => updateSet.mutate({ setId: set.id, workoutId, ...patch }), 500)
  }
  const onWeight = (w) => { setWeight(w); if (w !== '') push({ weight: w }) }
  const onReps = (r) => { setReps(r); if (r !== '') push({ reps: r }) }
  const onDone = (checked) => { clearTimeout(timerRef.current); updateSet.mutate({ setId: set.id, workoutId, done: checked }) }
  const onDelete = () => { clearTimeout(timerRef.current); deleteSet.mutate({ setId: set.id, workoutId }) }

  const weightless = ['bodyweight', 'band', 'time'].includes(exerciseUnit)
  const repUnit = exerciseUnit === 'time' ? 'sec' : 'reps'

  return (
    <div className={cn('flex items-center gap-3 rounded-lg px-3 py-2 transition-colors', set.done ? 'bg-emerald-50' : 'bg-zinc-50')}>
      <span className="w-5 text-center text-xs font-semibold text-zinc-500">{set.set_number}</span>

      {!weightless && (
        <Stepper value={weight} onChange={onWeight} step={increment} min={0} label="weight" unit={exerciseUnit} />
      )}
      <Stepper value={reps} onChange={onReps} step={1} min={1} label={repUnit} unit={repUnit} />

      <div className="flex flex-1 items-center justify-end gap-2">
        <Checkbox checked={!!set.done} onChange={onDone} label={`Mark set ${set.set_number} done`} round />
        <IconButton label="Delete set" onClick={onDelete} className="text-zinc-300 hover:bg-red-50 hover:text-red-500">
          <Trash2 className="h-3.5 w-3.5" />
        </IconButton>
      </div>
    </div>
  )
}
