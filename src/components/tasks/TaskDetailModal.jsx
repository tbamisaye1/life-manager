import { useLayoutEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Modal, Button, Input, Select, Label } from '../ui'
import { NestedPagesPanel } from '../pages/NestedPagesPanel'
import { tasks, projects as projectsResource } from '../../hooks/resources'
import { cn } from '../../lib/cn'

const PRIORITIES = ['low', 'normal', 'high', 'urgent']
const RECURRENCES = ['single', 'daily', 'weekly', 'monthly']

// Convert an ISO value to the value a datetime-local / date input expects.
const toInputValue = (iso) => {
  if (!iso) return ''
  return iso.length > 10 ? iso.slice(0, 16) : iso
}

/** Notes field that grows with the checklist instead of trapping it in 80px. */
function NotesEditor({ value, onChange, placeholder }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    const next = Math.min(Math.max(el.scrollHeight, 220), Math.floor(window.innerHeight * 0.55))
    el.style.height = `${next}px`
  }, [value])

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      spellCheck={false}
      className={cn(
        'w-full resize-y rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 py-3',
        'font-mono text-[13px] leading-relaxed text-zinc-800 placeholder:text-zinc-400',
        'focus-ring focus:border-accent-500 focus:bg-white',
        'min-h-[14rem] overflow-y-auto whitespace-pre-wrap',
      )}
    />
  )
}

/**
 * View + edit a single task. The parent passes `key={task?.id}` so this
 * remounts per task and initializes its draft cleanly — no sync effect needed.
 */
export function TaskDetailModal({ task, open, onClose }) {
  const [draft, setDraft] = useState(task || {})
  const { data: projectList = [] } = projectsResource.useList()
  const update = tasks.useUpdate()
  const remove = tasks.useRemove()

  if (!task) return null

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))

  const save = async () => {
    await update.mutateAsync({
      id: task.id,
      title: draft.title,
      due_date: draft.due_date || null,
      priority: draft.priority,
      recurrence: draft.recurrence,
      project_id: draft.project_id || null,
      notes: draft.notes || '',
      is_homework: draft.is_homework ? 1 : 0,
    })
    onClose()
  }

  const del = async () => { await remove.mutateAsync(task.id); onClose() }
  const homework = !!(Number(draft.is_homework) === 1 || draft.is_homework === true)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Task"
      className="max-w-2xl"
      bodyClassName="max-h-[min(78vh,44rem)]"
      footer={
        <>
          <Button variant="danger" onClick={del} className="mr-auto">
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label>Title</Label>
          <Input value={draft.title || ''} onChange={(e) => set({ title: e.target.value })} />
        </div>

        <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5">
          <input
            type="checkbox"
            checked={homework}
            onChange={(e) => set({ is_homework: e.target.checked ? 1 : 0 })}
            className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
          />
          <div className="leading-tight">
            <p className="text-sm font-medium text-zinc-800">Homework</p>
            <p className="text-xs text-zinc-500">Shows up under HW Tonight / HW This Week</p>
          </div>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Due date</Label>
            <Input
              type={hasTime(draft.due_date) ? 'datetime-local' : 'date'}
              value={toInputValue(draft.due_date)}
              onChange={(e) => set({ due_date: e.target.value })}
            />
          </div>
          <div>
            <Label>Project</Label>
            <Select value={draft.project_id || ''} onChange={(e) => set({ project_id: e.target.value })}>
              <option value="">None</option>
              {projectList.map((p) => (
                <option key={p.id} value={p.id}>{p.emoji} {p.short_code || p.name}</option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Priority</Label>
            <Select value={draft.priority || 'normal'} onChange={(e) => set({ priority: e.target.value })}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
            </Select>
          </div>
          <div>
            <Label>Repeats</Label>
            <Select value={draft.recurrence || 'single'} onChange={(e) => set({ recurrence: e.target.value })}>
              {RECURRENCES.map((r) => <option key={r} value={r}>{r === 'single' ? 'Does not repeat' : r[0].toUpperCase() + r.slice(1)}</option>)}
            </Select>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <Label className="mb-0">Notes / checklist</Label>
            <span className="text-[11px] text-zinc-400">Scrolls only if taller than half the screen</span>
          </div>
          <NotesEditor
            value={draft.notes || ''}
            onChange={(e) => set({ notes: e.target.value })}
            placeholder="GOAL, DO THIS, DONE WHEN…"
          />
        </div>

        {task.id && (
          <NestedPagesPanel hostType="task" hostId={task.id} hostLabel={draft.title} />
        )}
      </div>
    </Modal>
  )
}

const hasTime = (iso) => typeof iso === 'string' && iso.includes('T')
