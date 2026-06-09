import { useState } from 'react'
import { CheckSquare, Calendar, StickyNote } from 'lucide-react'
import { Modal, Button, Input, Select, Label } from '../ui'
import { cn } from '../../lib/cn'
import { tasks, events, notes, projects as projectsResource } from '../../hooks/resources'

const TYPES = [
  { key: 'task', label: 'Task', icon: CheckSquare },
  { key: 'event', label: 'Event', icon: Calendar },
  { key: 'note', label: 'Note', icon: StickyNote },
]

// One capture box for tasks/events/notes — create in one place, it lands in the
// right list/calendar automatically (related-query invalidation does the sync).
export function QuickAdd({ open, onClose }) {
  const [type, setType] = useState('task')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [projectId, setProjectId] = useState('')

  const { data: projectList = [] } = projectsResource.useList()
  const createTask = tasks.useCreate()
  const createEvent = events.useCreate()
  const createNote = notes.useCreate()

  const reset = () => { setTitle(''); setDate(''); setProjectId(''); setType('task') }
  const close = () => { reset(); onClose() }

  const submit = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    if (type === 'task') {
      await createTask.mutateAsync({ title, due_date: date || null, project_id: projectId || null })
    } else if (type === 'event') {
      await createEvent.mutateAsync({ title, start: date || new Date().toISOString().slice(0, 10), all_day: !date.includes('T'), project_id: projectId || null })
    } else {
      await createNote.mutateAsync({ title, body: '' })
    }
    close()
  }

  const pending = createTask.isPending || createEvent.isPending || createNote.isPending

  return (
    <Modal
      open={open}
      onClose={close}
      title="Quick add"
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={!title.trim() || pending}>
            {pending ? 'Adding…' : 'Add'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="flex gap-1.5">
          {TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setType(t.key)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-ring',
                type === t.key ? 'border-accent-500 bg-accent-50 text-accent-700' : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50',
              )}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>

        <div>
          <Label>Title</Label>
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`New ${type}…`} />
        </div>

        {type !== 'note' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{type === 'event' ? 'When' : 'Due date'}</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Project</Label>
              <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">None</option>
                {projectList.map((p) => (
                  <option key={p.id} value={p.id}>{p.emoji} {p.short_code || p.name}</option>
                ))}
              </Select>
            </div>
          </div>
        )}
      </form>
    </Modal>
  )
}
