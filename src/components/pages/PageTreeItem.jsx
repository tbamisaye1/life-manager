import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronRight, Plus } from 'lucide-react'
import { cn } from '../../lib/cn'
import { IconButton } from '../ui/IconButton'

/** One row in the page tree — expand/collapse, open, and add-subpage. */
export function PageTreeItem({ page, depth = 0, onAddSub, addingParentId }) {
  const { id: activeId } = useParams()
  const navigate = useNavigate()
  const [manualOpen, setManualOpen] = useState(null)
  const hasChildren = page.children?.length > 0
  const active = activeId === page.id
  const addingHere = addingParentId === page.id
  const autoOpen = depth < 1 || active || hasChildren
  const open = manualOpen ?? autoOpen

  const toggleOpen = () => {
    setManualOpen(!open)
  }

  const addSub = (e) => {
    e.preventDefault()
    e.stopPropagation()
    onAddSub(page.id)
  }

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-0.5 rounded-md py-0.5 pr-0.5 transition-colors',
          active ? 'bg-white shadow-sm' : 'hover:bg-zinc-200/50',
        )}
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
      >
        <button
          type="button"
          onClick={() => hasChildren && toggleOpen()}
          aria-label={hasChildren ? (open ? 'Collapse' : 'Expand') : undefined}
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-200/60',
            !hasChildren && 'pointer-events-none opacity-0',
          )}
        >
          <ChevronRight className={cn('h-4 w-4 transition-transform', open && 'rotate-90')} />
        </button>

        <button
          type="button"
          onClick={() => navigate(`/notes/${page.id}`)}
          className={cn(
            'flex min-h-8 min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 py-1.5 text-left text-sm focus-ring',
            active ? 'font-medium text-zinc-900' : 'text-zinc-600',
          )}
        >
          <span className="shrink-0 text-sm">{page.icon || '📄'}</span>
          <span className="truncate">{page.title || 'Untitled'}</span>
        </button>

        <IconButton
          label="Add subpage"
          onClick={addSub}
          disabled={addingHere}
          className={cn(
            'h-8 w-8 shrink-0 opacity-50 hover:opacity-100 group-hover:opacity-80',
            (active || addingHere) && 'opacity-100',
          )}
        >
          <Plus className="h-4 w-4" />
        </IconButton>
      </div>

      {hasChildren && open && (
        <div>
          {page.children.map((child) => (
            <PageTreeItem
              key={child.id}
              page={child}
              depth={depth + 1}
              onAddSub={onAddSub}
              addingParentId={addingParentId}
            />
          ))}
        </div>
      )}
    </div>
  )
}
