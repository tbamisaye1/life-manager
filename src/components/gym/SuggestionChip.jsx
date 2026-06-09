import { ArrowUp, ArrowRight, ArrowDown, Sparkles } from 'lucide-react'
import { cn } from '../../lib/cn'

const DIRECTION_CONFIG = {
  up: {
    icon: ArrowUp,
    bg: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-700',
    iconColor: 'text-emerald-500',
    label: 'Go up',
  },
  hold: {
    icon: ArrowRight,
    bg: 'bg-zinc-50 border-zinc-200',
    text: 'text-zinc-700',
    iconColor: 'text-zinc-400',
    label: 'Hold',
  },
  down: {
    icon: ArrowDown,
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-700',
    iconColor: 'text-amber-500',
    label: 'Go down',
  },
  new: {
    icon: Sparkles,
    bg: 'bg-blue-50 border-blue-200',
    text: 'text-blue-700',
    iconColor: 'text-blue-500',
    label: 'First time',
  },
}

/** Displays the AI suggestion for this exercise: direction chip + weight×reps + rationale. */
export function SuggestionChip({ suggestion, unit }) {
  if (!suggestion) return null

  const dir = DIRECTION_CONFIG[suggestion.direction] ?? DIRECTION_CONFIG.hold
  const Icon = dir.icon

  const weightless = unit === 'bodyweight' || unit === 'band' || unit === 'time'
  const repLabel = unit === 'time' ? 'sec' : 'reps'

  const mainText = weightless
    ? `${suggestion.reps} ${repLabel} × ${suggestion.sets} sets`
    : suggestion.weight != null
      ? `${suggestion.weight}${unit} × ${suggestion.reps} × ${suggestion.sets}`
      : `${suggestion.reps} reps × ${suggestion.sets} sets`

  return (
    <div className={cn('inline-flex flex-col gap-0.5 rounded-lg border px-3 py-2', dir.bg)}>
      <div className={cn('flex items-center gap-1.5 text-sm font-semibold', dir.text)}>
        <Icon className={cn('h-3.5 w-3.5 shrink-0', dir.iconColor)} />
        <span>{mainText}</span>
      </div>
      {suggestion.rationale && (
        <p className="pl-5 text-xs text-zinc-500 leading-snug">{suggestion.rationale}</p>
      )}
      {suggestion.last && (
        <p className="pl-5 text-xs text-zinc-400 leading-snug">
          Last: {suggestion.last.weight != null ? `${suggestion.last.weight}${unit} × ` : ''}{suggestion.last.reps} reps × {suggestion.last.sets} sets
        </p>
      )}
    </div>
  )
}
