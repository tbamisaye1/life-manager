import { useLayoutEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { useNavLabel, useRenameNavLabel } from '../../hooks/useNavLabels'
import { useUpdatePage } from '../../hooks/usePages'

/** Inline-editable nav page title — for top bar and page headers. */
export function EditableNavTitle({ path, className, inputClassName }) {
  const title = useNavLabel(path)
  const rename = useRenameNavLabel()
  const [editing, setEditing] = useState(false)
  const inputRef = useRef(null)

  useLayoutEffect(() => {
    if (editing) inputRef.current?.focus({ preventScroll: true })
  }, [editing])

  const commit = (raw) => {
    const next = raw.trim()
    if (next && next !== title) rename.mutate({ items: { [path]: next } })
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        defaultValue={title}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(e.currentTarget.value) }
          if (e.key === 'Escape') { e.preventDefault(); setEditing(false) }
        }}
        className={cn(
          'min-w-0 rounded border-0 bg-transparent font-semibold text-zinc-900 ring-1 ring-zinc-300/80 focus:outline-none',
          inputClassName,
          className,
        )}
      />
    )
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onDoubleClick={() => setEditing(true)}
      onKeyDown={(e) => { if (e.key === 'Enter') setEditing(true) }}
      title="Double-click to rename"
      className={cn('truncate cursor-text', className)}
    >
      {title}
    </span>
  )
}

/** Inline-editable note page title — for top bar on /notes/:id routes. */
export function EditableNoteTitle({ page, className, inputClassName }) {
  const update = useUpdatePage()
  const [editing, setEditing] = useState(false)
  const inputRef = useRef(null)
  const title = page?.title || 'Untitled'

  useLayoutEffect(() => {
    if (editing) inputRef.current?.focus({ preventScroll: true })
  }, [editing])

  const commit = (raw) => {
    const next = raw.trim()
    if (next && next !== page.title) update.mutate({ id: page.id, title: next })
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        defaultValue={title}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(e.currentTarget.value) }
          if (e.key === 'Escape') { e.preventDefault(); setEditing(false) }
        }}
        className={cn(
          'min-w-0 rounded border-0 bg-transparent font-semibold text-zinc-900 ring-1 ring-zinc-300/80 focus:outline-none',
          inputClassName,
          className,
        )}
      />
    )
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onDoubleClick={() => setEditing(true)}
      onKeyDown={(e) => { if (e.key === 'Enter') setEditing(true) }}
      title="Double-click to rename"
      className={cn('truncate cursor-text', className)}
    >
      {title}
    </span>
  )
}
