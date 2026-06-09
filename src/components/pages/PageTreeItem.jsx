import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronRight, Plus } from 'lucide-react'
import { cn } from '../../lib/cn'
import { IconButton } from '../ui/IconButton'

/** One row in the page tree — expand/collapse, open, and add-subpage. */
export function PageTreeItem({ page, depth = 0, onAddSub }) {
  const { id: activeId } = useParams()
  const navigate = useNavigate()
  const [open, setOpen] = useState(depth < 1) // top level expanded by default
  const hasChildren = page.children?.length > 0
  const active = activeId === page.id

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-1 rounded-md py-1 pr-1 transition-colors',
          active ? 'bg-white shadow-sm' : 'hover:bg-zinc-200/50',
        )}
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
      >
        <button
          type="button"
          onClick={() => hasChildren && setOpen((o) => !o)}
          aria-label={hasChildren ? (open ? 'Collapse' : 'Expand') : undefined}
          className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded text-zinc-400', !hasChildren && 'invisible')}
        >
          <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-90')} />
        </button>

        <button
          type="button"
          onClick={() => navigate(`/notes/${page.id}`)}
          className={cn('flex min-w-0 flex-1 items-center gap-1.5 text-left text-sm focus-ring rounded', active ? 'font-medium text-zinc-900' : 'text-zinc-600')}
        >
          <span className="shrink-0 text-sm">{page.icon || '📄'}</span>
          <span className="truncate">{page.title || 'Untitled'}</span>
        </button>

        <IconButton label="Add subpage" onClick={() => onAddSub(page.id)} className="h-6 w-6 opacity-0 group-hover:opacity-100">
          <Plus className="h-3.5 w-3.5" />
        </IconButton>
      </div>

      {hasChildren && open && (
        <div>
          {page.children.map((child) => (
            <PageTreeItem key={child.id} page={child} depth={depth + 1} onAddSub={onAddSub} />
          ))}
        </div>
      )}
    </div>
  )
}
