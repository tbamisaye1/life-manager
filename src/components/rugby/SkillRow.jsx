import { Minus, Plus } from 'lucide-react'
import { IconButton, ProgressBar } from '../ui'
import { useUpdateSkill } from '../../hooks/useRugby'

/** One skill row: name, progress bar (current/target), level numbers, +/- nudge buttons. */
export function SkillRow({ skill }) {
  const updateSkill = useUpdateSkill()
  const { id, name, current_level, target_level } = skill

  const nudge = (delta) => {
    const next = Math.max(1, Math.min(10, current_level + delta))
    if (next === current_level) return
    updateSkill.mutate({ id, current_level: next })
  }

  const pct = Math.round((current_level / target_level) * 100)

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-zinc-800">{name}</span>
          <span className="shrink-0 text-xs text-zinc-400">
            {current_level} → {target_level}
          </span>
        </div>
        <ProgressBar value={pct} />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <IconButton
          label="Decrease level"
          onClick={() => nudge(-1)}
          disabled={current_level <= 1 || updateSkill.isPending}
        >
          <Minus className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton
          label="Increase level"
          onClick={() => nudge(1)}
          disabled={current_level >= 10 || updateSkill.isPending}
        >
          <Plus className="h-3.5 w-3.5" />
        </IconButton>
      </div>
    </div>
  )
}
