import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { Checkbox } from '../ui/Checkbox'
import { Button, Input, Label } from '../ui'
import { tasks as tasksResource } from '../../hooks/resources'
import { cn } from '../../lib/cn'
import { subtasksOf } from '../../lib/taskFilters'

/**
 * Inline editor for a parent task's checklist of subtasks.
 * Creates / toggles / renames / deletes immediately (no wait for parent Save).
 */
export function SubtasksEditor({ parentId, allTasks = [] }) {
  const [draft, setDraft] = useState('')
  const create = tasksResource.useCreate()
  const update = tasksResource.useUpdate()
  const remove = tasksResource.useRemove()
  const kids = subtasksOf(allTasks, parentId)
  const done = kids.filter((t) => t.status === 'done').length

  const add = async () => {
    const title = draft.trim()
    if (!title || !parentId) return
    setDraft('')
    await create.mutateAsync({ title, parent_id: parentId })
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      add()
    }
  }

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <Label className="mb-0">Subtasks</Label>
        {kids.length > 0 && (
          <span className="text-[11px] tabular-nums text-zinc-400">
            {done}/{kids.length} done
          </span>
        )}
      </div>
      <p className="mb-2 text-[11px] text-zinc-400">
        Break this into smaller steps. Checking them off here does not complete the parent.
      </p>

      <ul className="mb-2 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50/80">
        {kids.length === 0 && (
          <li className="px-3 py-2.5 text-xs text-zinc-400">No subtasks yet</li>
        )}
        {kids.map((child) => {
          const childDone = child.status === 'done'
          return (
            <li
              key={child.id}
              className="flex items-center gap-2 border-b border-zinc-100 px-2.5 py-1.5 last:border-b-0"
            >
              <Checkbox
                checked={childDone}
                onChange={() =>
                  update.mutate({
                    id: child.id,
                    status: childDone ? 'todo' : 'done',
                  })
                }
                label={`Complete ${child.title}`}
              />
              <input
                defaultValue={child.title}
                onBlur={(e) => {
                  const next = e.target.value.trim()
                  if (!next || next === child.title) return
                  update.mutate({ id: child.id, title: next })
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                }}
                className={cn(
                  'min-w-0 flex-1 bg-transparent text-sm outline-none focus-ring rounded px-1 py-0.5',
                  childDone ? 'text-zinc-400 line-through' : 'text-zinc-800',
                )}
              />
              <button
                type="button"
                onClick={() => remove.mutate(child.id)}
                className="rounded p-1 text-zinc-300 hover:bg-zinc-100 hover:text-rose-500 focus-ring"
                aria-label={`Delete ${child.title}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          )
        })}
      </ul>

      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Add a subtask and press Enter"
          className="flex-1"
        />
        <Button
          type="button"
          variant="primary"
          onClick={add}
          disabled={!draft.trim() || create.isPending || !parentId}
          className="shrink-0"
        >
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>
    </div>
  )
}

/** Compact progress chip for list rows: "2/3". */
export function SubtaskProgressChip({ done, total, className }) {
  if (!total) return null
  const allDone = done >= total
  return (
    <span
      className={cn(
        'hidden shrink-0 items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums sm:inline-flex',
        allDone ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-500',
        className,
      )}
    >
      {done}/{total}
    </span>
  )
}

/** Expand / collapse control for inline subtask list on a row. */
export function SubtaskExpandButton({ open, onToggle, total }) {
  if (!total) return null
  const Icon = open ? ChevronDown : ChevronRight
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      className="rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 focus-ring"
      aria-expanded={open}
      aria-label={open ? 'Hide subtasks' : 'Show subtasks'}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}
