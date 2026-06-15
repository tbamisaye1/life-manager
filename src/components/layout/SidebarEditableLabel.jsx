import { useState } from 'react'
import { cn } from '../../lib/cn'

/** Notion-style inline rename — double-click to edit, Enter/blur to save, Escape to cancel. */
export function SidebarEditableLabel({
  value,
  onSave,
  editing: editingProp,
  onEditingChange,
  className,
  uppercase = false,
}) {
  const [internalEditing, setInternalEditing] = useState(false)
  const editing = editingProp ?? internalEditing
  const setEditing = (next) => {
    if (onEditingChange) onEditingChange(next)
    else setInternalEditing(next)
  }

  const start = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setEditing(true)
  }

  const commit = (raw) => {
    const next = raw.trim()
    if (next && next !== value) onSave(next)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        key={value}
        autoFocus
        defaultValue={value}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(e.currentTarget.value) }
          if (e.key === 'Escape') { e.preventDefault(); setEditing(false) }
        }}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        className={cn(
          'min-w-0 flex-1 rounded px-1 py-0.5 text-sm text-zinc-900 ring-1 ring-zinc-300/80 bg-zinc-50/80',
          uppercase && 'text-[11px] font-semibold uppercase tracking-wider',
          className,
        )}
      />
    )
  }

  return (
    <span
      onDoubleClick={start}
      title="Double-click to rename"
      className={cn('truncate', className)}
    >
      {value}
    </span>
  )
}
