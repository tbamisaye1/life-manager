import { Trash2 } from 'lucide-react'
import { Checkbox } from '../ui/Checkbox'
import { IconButton } from '../ui/IconButton'
import { DeadlineBadge } from '../ui/DeadlineBadge'
import { cn } from '../../lib/cn'
import { platformMeta } from './platforms'

/** A "people I owe a reply" row. */
export function ReplyItem({ reply, onToggle, onDelete }) {
  const meta = platformMeta(reply.platform)
  return (
    <div className="group flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-50">
      <Checkbox round checked={reply.done} onChange={() => onToggle(reply)} label={`Replied to ${reply.person}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-medium', reply.done ? 'text-zinc-400 line-through' : 'text-zinc-800')}>
            {reply.person}
          </span>
          <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium', meta.cls)}>{meta.label}</span>
        </div>
        {reply.context && <p className="truncate text-xs text-zinc-400">{reply.context}</p>}
      </div>
      {reply.due_date && !reply.done && <DeadlineBadge date={reply.due_date} />}
      <IconButton label="Remove" onClick={() => onDelete(reply.id)} className="opacity-0 group-hover:opacity-100">
        <Trash2 className="h-3.5 w-3.5" />
      </IconButton>
    </div>
  )
}
