import { useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { ChevronRight, Plus } from 'lucide-react'
import { cn } from '../../lib/cn'
import { IconButton } from '../ui/IconButton'
import { SidebarEditableLabel } from './SidebarEditableLabel'
import { SidebarRowMenu } from './SidebarRowMenu'
import { useFavorites } from '../../hooks/useFavorites'
import { useUpdatePage, useDeletePage } from '../../hooks/usePages'

/** One page row — used in the main sidebar tree and the Notes page panel. */
export function PageTreeRow({
  page,
  depth = 0,
  onAddSub,
  addingParentId,
  compact = false,
}) {
  const { id: activeId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const active = activeId === page.id || location.pathname === `/notes/${page.id}`
  const [manualOpen, setManualOpen] = useState(null)
  const [editing, setEditing] = useState(false)
  const hasChildren = page.children?.length > 0
  const addingHere = addingParentId === page.id
  const onPath = active || page.children?.some((c) => location.pathname === `/notes/${c.id}`)
  const autoOpen = onPath || (compact ? active : depth < 1)
  const open = manualOpen ?? autoOpen

  const update = useUpdatePage()
  const remove = useDeletePage()
  const { isFavorite, toggle } = useFavorites()
  const path = `/notes/${page.id}`
  const favved = isFavorite(path)

  const toggleOpen = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (hasChildren) setManualOpen(!open)
  }

  const openPage = () => navigate(`/notes/${page.id}`)

  const menu = [
    { key: 'rename', label: 'Rename', onSelect: () => setEditing(true) },
    { key: 'subpage', label: 'Add subpage', onSelect: () => onAddSub?.(page.id) },
    {
      key: 'favorite',
      label: favved ? 'Remove from favorites' : 'Add to favorites',
      onSelect: () => toggle({ path, label: page.title || 'Untitled', icon: 'FileText' }),
    },
    { key: 'sep', type: 'separator' },
    {
      key: 'delete',
      label: 'Delete',
      danger: true,
      onSelect: () => {
        if (!window.confirm(`Delete “${page.title || 'Untitled'}” and its subpages?`)) return
        remove.mutate(page.id, { onSuccess: () => navigate('/notes') })
      },
    },
  ]

  const indent = depth * (compact ? 10 : 14)

  return (
    <div>
      <div
        className={cn(
          'group relative flex items-center gap-0.5 rounded-md py-0.5 pr-7 transition-colors',
          active ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:bg-zinc-200/50 hover:text-zinc-700',
        )}
        style={{ paddingLeft: `${indent + 2}px` }}
      >
        <button
          type="button"
          onClick={toggleOpen}
          aria-label={hasChildren ? (open ? 'Collapse' : 'Expand') : undefined}
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-600',
            !hasChildren && 'pointer-events-none invisible',
          )}
        >
          <ChevronRight className={cn('h-3 w-3 transition-transform duration-150', open && 'rotate-90')} />
        </button>

        <button
          type="button"
          onClick={openPage}
          className={cn(
            'flex min-h-6 min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 py-0.5 text-left focus-ring',
            compact ? 'text-[13px]' : 'text-sm',
            active ? 'font-medium text-zinc-900' : 'font-normal',
          )}
        >
          <span className={cn('shrink-0 leading-none', compact ? 'text-[13px]' : 'text-sm')}>{page.icon || '📄'}</span>
          <SidebarEditableLabel
            value={page.title || 'Untitled'}
            onSave={(title) => update.mutate({ id: page.id, title })}
            editing={editing}
            onEditingChange={setEditing}
            className="min-w-0 flex-1"
          />
        </button>

        {!compact && (
          <IconButton
            label="Add subpage"
            onClick={(e) => { e.stopPropagation(); onAddSub?.(page.id) }}
            disabled={addingHere}
            className={cn(
              'absolute right-7 top-1/2 h-6 w-6 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100',
              (active || addingHere) && 'opacity-100',
            )}
          >
            <Plus className="h-3.5 w-3.5" />
          </IconButton>
        )}

        <SidebarRowMenu items={menu} visible={active || editing} />
      </div>

      {hasChildren && open && (
        <div>
          {page.children.map((child) => (
            <PageTreeRow
              key={child.id}
              page={child}
              depth={depth + 1}
              onAddSub={onAddSub}
              addingParentId={addingParentId}
              compact={compact}
            />
          ))}
        </div>
      )}
    </div>
  )
}
