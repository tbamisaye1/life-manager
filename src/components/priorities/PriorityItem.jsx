import { FileText } from 'lucide-react'
import { Checkbox } from '../ui/Checkbox'
import { Badge } from '../ui/Badge'
import { cn } from '../../lib/cn'

// True only when the body has real content (not just an empty TipTap doc,
// which still serializes to ~45 chars).
const hasDetail = (body) =>
  typeof body === 'string' &&
  (/"type":"text"/.test(body) || /"type":"(heading|bulletList|orderedList|taskList|blockquote|codeBlock)"/.test(body))

/** A recurring-priority checklist row. Reused on Today and the Priorities page. */
export function PriorityItem({ priority, onCheck, onOpen }) {
  const done = priority.done_for_period
  return (
    <div className="group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-zinc-50">
      <Checkbox round checked={done} onChange={() => onCheck(priority.id)} label={priority.title} />
      {priority.emoji && <span className="text-sm">{priority.emoji}</span>}
      <button
        type="button"
        onClick={() => onOpen?.(priority)}
        disabled={!onOpen}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-1.5 text-left text-sm focus-ring rounded',
          done ? 'text-zinc-400 line-through' : 'text-zinc-800',
          onOpen && 'hover:text-accent-700',
        )}
      >
        <span className="truncate">{priority.title}</span>
        {hasDetail(priority.body) && <FileText className="h-3.5 w-3.5 shrink-0 text-zinc-300" />}
      </button>
      <Badge tone={priority.cadence === 'weekly' ? 'blue' : 'neutral'}>{priority.cadence}</Badge>
    </div>
  )
}
