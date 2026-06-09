import { Checkbox } from '../ui/Checkbox'
import { Badge } from '../ui/Badge'
import { cn } from '../../lib/cn'

/** A recurring-priority checklist row. Reused on Today and the Priorities page. */
export function PriorityItem({ priority, onCheck }) {
  const done = priority.done_for_period
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-zinc-50">
      <Checkbox round checked={done} onChange={() => onCheck(priority.id)} label={priority.title} />
      {priority.emoji && <span className="text-sm">{priority.emoji}</span>}
      <span className={cn('flex-1 text-sm', done ? 'text-zinc-400 line-through' : 'text-zinc-800')}>
        {priority.title}
      </span>
      <Badge tone={priority.cadence === 'weekly' ? 'blue' : 'neutral'}>{priority.cadence}</Badge>
    </div>
  )
}
