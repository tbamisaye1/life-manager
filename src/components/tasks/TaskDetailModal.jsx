import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Modal, Button, Input, Textarea, Select, Label } from '../ui'
import { tasks, projects as projectsResource } from '../../hooks/resources'

const PRIORITIES = ['low', 'normal', 'high', 'urgent']
const RECURRENCES = ['single', 'daily', 'weekly', 'monthly']

// Convert an ISO value to the value a datetime-local / date input expects.
const toInputValue = (iso) => {
  if (!iso) return ''
  return iso.length > 10 ? iso.slice(0, 16) : iso
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
    })
    onClose()
  }

  const del = async () => { await remove.mutateAsync(task.id); onClose() }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Task"
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
          <Label>Notes</Label>
          <Textarea value={draft.notes || ''} onChange={(e) => set({ notes: e.target.value })} placeholder="Add detail…" />
        </div>
      </div>
    </Modal>
  )
}

const hasTime = (iso) => typeof iso === 'string' && iso.includes('T')
