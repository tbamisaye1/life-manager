import { FileText, Trash2 } from 'lucide-react'
import { Checkbox } from '../ui/Checkbox'
import { Badge } from '../ui/Badge'
import { IconButton } from '../ui/IconButton'
import { cn } from '../../lib/cn'
import { categoryMeta } from './categories'

const hasDetail = (body) =>
  typeof body === 'string' &&
  (/"type":"text"/.test(body) || /"type":"(heading|bulletList|orderedList|taskList|blockquote|codeBlock)"/.test(body))

/** One row in the curated Bored list. Click the title to open/edit detail. */
export function BoredItemRow({ item, onToggle, onOpen, onDelete, highlighted }) {
  const cat = categoryMeta(item.category)
  return (
    <div className={cn('group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-zinc-50', highlighted && 'bg-accent-50')}>
      <Checkbox round checked={item.done} onChange={() => onToggle(item)} label={`Mark ${item.title} done`} />
      <span className="text-sm">{item.emoji || '💡'}</span>
      <button
        type="button"
        onClick={() => onOpen(item)}
        className={cn('flex min-w-0 flex-1 items-center gap-1.5 text-left text-sm focus-ring rounded hover:text-accent-700',
          item.done ? 'text-zinc-400 line-through' : 'text-zinc-800')}
      >
        <span className="truncate">{item.title}</span>
        {hasDetail(item.body) && <FileText className="h-3.5 w-3.5 shrink-0 text-zinc-300" />}
      </button>
      <Badge tone={cat.tone}>{cat.label}</Badge>
      <IconButton label="Delete" onClick={() => onDelete(item.id)} className="opacity-0 group-hover:opacity-100">
        <Trash2 className="h-3.5 w-3.5" />
      </IconButton>
    </div>
  )
}
